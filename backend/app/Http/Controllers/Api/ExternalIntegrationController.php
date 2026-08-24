<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PostRequest;
use App\Models\PostCategory;
use App\Models\PostMedia;
use App\Services\ApprovalWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Http;

class ExternalIntegrationController extends Controller
{
    /** Content types we will accept from an external image_url, mapped to a file extension. */
    private const ALLOWED_IMAGE_TYPES = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/gif'  => 'gif',
    ];

    private const MAX_IMAGE_BYTES = 8388608; // 8 MiB

    public function __construct(
        private ApprovalWorkflowService $workflowService
    ) {}

    /**
     * Submit a new content request from an external application.
     */
    public function submitRequest(Request $request, \App\Services\FacebookPublishingService $facebookService): JsonResponse
    {
        if (!$request->isJson()) {
            return response()->json(['message' => 'Only JSON payloads are accepted. Please set Content-Type to application/json.'], 415);
        }

        $request->validate([
            'title' => 'required|string|max:255',
            'caption_narrative' => 'required|string',
            'category_id' => 'nullable|exists:post_categories,id',
            'target_platforms' => 'nullable|array',
            'image_url' => 'nullable|url',
        ]);

        // publish_direct skips Office Head -> VP -> IMC/QA entirely and pushes
        // straight to the live page, so it is limited to the publisher roles.
        // Any other token holder may only submit into the normal approval flow.
        if ($request->boolean('publish_direct')
            && !$request->user()->hasAnyRole(['it_publisher', 'it_admin'])) {
            return response()->json([
                'message' => 'Direct publishing is restricted to IT Publisher accounts. '
                    . 'Omit publish_direct to route this request through the normal approval workflow.',
            ], 403);
        }

        if ($request->image_url) {
            try {
                $this->assertSafeImageUrl($request->image_url);
            } catch (\InvalidArgumentException $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
        }

        return DB::transaction(function () use ($request) {
            $categoryId = $request->category_id;
            if (!$categoryId) {
                $categoryId = PostCategory::where('is_active', true)->value('id');
            }

            $user = $request->user(); // The user who owns the token

            $post = PostRequest::create([
                'title' => $request->title,
                'slug' => Str::slug($request->title) . '-' . Str::random(6),
                'caption_narrative' => $request->caption_narrative,
                'category_id' => $categoryId,
                'department_id' => $user->id,
                'requestor_id' => $user->id,
                'status' => $request->boolean('publish_direct') ? PostRequest::STATUS_PUBLISHED : PostRequest::STATUS_PENDING_OFFICE_HEAD,
                'target_platforms' => $request->target_platforms ?? ['facebook'],
                'revision_count' => 0,
            ]);

            $mediaPath = null;

            // Handle external image download
            if ($request->image_url) {
                try {
                    // Redirects are disabled: a 30x to an internal address would
                    // otherwise defeat the pre-flight host check above.
                    $response = Http::withOptions(['allow_redirects' => false])
                        ->timeout(15)
                        ->get($request->image_url);

                    $contentType = strtolower(trim(explode(';', (string) $response->header('Content-Type'))[0]));
                    $extension = self::ALLOWED_IMAGE_TYPES[$contentType] ?? null;
                    $bytes = strlen($response->body());

                    if (!$response->successful()) {
                        \Illuminate\Support\Facades\Log::warning('External image fetch returned ' . $response->status(), ['post_id' => $post->id]);
                    } elseif ($extension === null) {
                        \Illuminate\Support\Facades\Log::warning('External image rejected: unsupported content type ' . $contentType, ['post_id' => $post->id]);
                    } elseif ($bytes > self::MAX_IMAGE_BYTES) {
                        \Illuminate\Support\Facades\Log::warning('External image rejected: ' . $bytes . ' bytes exceeds limit', ['post_id' => $post->id]);
                    } else {
                        $filename = 'external_' . Str::random(10) . '.' . $extension;
                        $path = 'post-media/' . $post->id . '/' . $filename;

                        $storageDisk = config('filesystems.default') === 'local' ? 'public' : config('filesystems.default');
                        Storage::disk($storageDisk)->put($path, $response->body());

                        $media = PostMedia::create([
                            'post_request_id' => $post->id,
                            'type' => 'image',
                            'original_name' => $filename,
                            'file_path' => $path,
                            'mime_type' => $contentType,
                            'file_size' => $bytes,
                            'sort_order' => 0,
                            'is_featured' => true,
                        ]);

                        $media->file()->create([
                            'content' => $response->body(),
                        ]);

                        $disk = config('filesystems.default');
                        if ($disk === 's3' || $disk === 'b2') {
                            $mediaPath = $media->url;
                        } else {
                            $mediaPath = Storage::disk('public')->path($media->file_path);
                        }
                    }
                } catch (\Exception $e) {
                    // Log error but don't fail the request
                    \Illuminate\Support\Facades\Log::error('External image download failed: ' . $e->getMessage());
                }
            }

            if ($request->boolean('publish_direct')) {
                // Publish to Facebook instantly
                $publishResults = [];
                $platforms = $post->target_platforms;
                if (!is_array($platforms)) $platforms = [];
                $lowerPlatforms = array_map('strtolower', $platforms);

                if (in_array('facebook', $lowerPlatforms) || in_array('fb', $lowerPlatforms)) {
                    try {
                        $message = $post->caption_narrative ?? '';
                        $fbResponse = $facebookService->publishPost($message, $mediaPath);
                        $publishResults['facebook'] = $fbResponse;
                    } catch (\Exception $e) {
                        \Illuminate\Support\Facades\Log::error('Direct API Publish to Facebook failed: ' . $e->getMessage());
                        $publishResults['facebook'] = ['error' => $e->getMessage()];
                    }
                }

                \App\Services\AuditLogService::log(
                    'POST_PUBLISHED',
                    "Direct API publish \"{$post->title}\" to selected platforms.",
                    'INFO',
                    [
                        'postId'    => $post->id,
                        'platforms' => $platforms,
                        'results'   => $publishResults
                    ]
                );

                return response()->json([
                    'data' => [
                        'id' => $post->id,
                        'title' => $post->title,
                        'status' => $post->status,
                        'publish_results' => $publishResults,
                        'created_at' => $post->created_at,
                    ],
                    'message' => 'Post successfully published directly from external source.',
                ], 201);
            }

            // Normal Flow: Create approval workflow stages
            $this->workflowService->initializeWorkflow($post);
            $this->workflowService->notifyApprovers($post);

            return response()->json([
                'data' => [
                    'id' => $post->id,
                    'title' => $post->title,
                    'status' => $post->status,
                    'created_at' => $post->created_at,
                ],
                'message' => 'Post submitted for approval from external source successfully.',
            ], 201);
        });
    }

    /**
     * Reject an image_url that does not point at a public host.
     *
     * Without this, the endpoint is a server-side request forgery primitive: the
     * caller supplies any URL and we fetch it from inside Railway's network,
     * where sibling services on *.railway.internal and cloud metadata endpoints
     * are reachable but not exposed to the internet.
     *
     * Residual risk: DNS may resolve differently between this check and the
     * fetch (rebinding). Redirects are disabled at the call site, which closes
     * the practical version of that attack; pinning the resolved address would
     * be needed to close it completely.
     *
     * @throws \InvalidArgumentException when the URL must not be fetched.
     */
    private function assertSafeImageUrl(string $url): void
    {
        $parts  = parse_url($url);
        $scheme = strtolower($parts['scheme'] ?? '');
        $host   = $parts['host'] ?? '';

        if (!in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw new \InvalidArgumentException('image_url must be an http or https URL.');
        }

        if (isset($parts['port']) && !in_array((int) $parts['port'], [80, 443], true)) {
            throw new \InvalidArgumentException('image_url may only use port 80 or 443.');
        }

        $addresses = $this->resolveHost($host);

        if ($addresses === []) {
            throw new \InvalidArgumentException('image_url host could not be resolved.');
        }

        // Every address the host maps to must be public — one private result is fatal.
        foreach ($addresses as $address) {
            $isPublic = filter_var(
                $address,
                FILTER_VALIDATE_IP,
                FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
            );

            if ($isPublic === false) {
                throw new \InvalidArgumentException('image_url must point to a publicly routable host.');
            }
        }
    }

    /**
     * Every IPv4 and IPv6 address a host resolves to. A literal IP resolves to itself.
     *
     * Both resolvers are used on purpose: dns_get_record() queries DNS only, while
     * gethostbynamel() also honours the system hosts file, which is how a name like
     * "localhost" maps to a loopback address. Missing that would leave such a host
     * unresolved, and "unresolved" must not be the reason a private target is
     * rejected — the caller returns an empty list and the check above then fails
     * closed on an explicit range test instead.
     *
     * @return list<string>
     */
    private function resolveHost(string $host): array
    {
        // parse_url() keeps the brackets on an IPv6 literal; strip them so the
        // address is testable as an IP rather than falling through to DNS.
        $host = trim($host, '[]');

        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return [$host];
        }

        $addresses = [];

        foreach ([DNS_A => 'ip', DNS_AAAA => 'ipv6'] as $type => $field) {
            foreach (@dns_get_record($host, $type) ?: [] as $record) {
                if (!empty($record[$field])) {
                    $addresses[] = $record[$field];
                }
            }
        }

        foreach (@gethostbynamel($host) ?: [] as $address) {
            $addresses[] = $address;
        }

        return array_values(array_unique($addresses));
    }
}
