<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\AutoPublishJob;
use App\Models\AuditLog;
use App\Models\PostCategory;
use App\Models\PostMedia;
use App\Models\PostRequest;
use App\Models\PublishingRecord;
use App\Models\SystemSetting;
use App\Services\AuditLogService;
use App\Services\SystemAlertService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AgentIntegrationController extends Controller
{
    private const ALLOWED_IMAGE_TYPES = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/gif'  => 'gif',
    ];

    private const MAX_IMAGE_BYTES = 8388608; // 8 MiB

    /**
     * List posts with optional filters (status, search, category).
     */
    public function index(Request $request): JsonResponse
    {
        $query = PostRequest::with(['category:id,name', 'department', 'media:id,post_request_id,file_name,file_path,file_type,is_featured']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('caption_narrative', 'like', "%{$search}%");
            });
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        $posts = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'data' => $posts->items(),
            'pagination' => [
                'current_page' => $posts->currentPage(),
                'per_page' => $posts->perPage(),
                'total' => $posts->total(),
                'last_page' => $posts->lastPage(),
            ],
        ]);
    }

    /**
     * Retrieve single post details, including publishing records and media.
     */
    public function show(int $id): JsonResponse
    {
        $post = PostRequest::with([
            'category:id,name',
            'department',
            'media',
            'publishingRecords',
            'approvalWorkflows',
        ])->find($id);

        if (!$post) {
            return response()->json(['status' => 'error', 'message' => "Post #{$id} not found."], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $post,
        ]);
    }

    /**
     * Create a post. Supports instant bypass approval & direct publishing.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'caption_narrative' => 'required|string',
            'category_id' => 'nullable|exists:post_categories,id',
            'target_platforms' => 'nullable|array',
            'image_url' => 'nullable|url',
            'direct_publish' => 'nullable|boolean',
            'bypass_approval' => 'nullable|boolean',
        ]);

        $shouldDirectPublish = $request->boolean('direct_publish') || $request->boolean('bypass_approval');

        if ($shouldDirectPublish && !$request->user()->hasAnyRole(['it_publisher', 'it_admin'])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Direct publishing / workflow bypass requires IT Admin or IT Publisher privileges.',
            ], 403);
        }

        if ($request->image_url) {
            try {
                $this->assertSafeImageUrl($request->image_url);
            } catch (\InvalidArgumentException $e) {
                return response()->json(['status' => 'error', 'message' => $e->getMessage()], 422);
            }
        }

        $user = $request->user();

        $post = DB::transaction(function () use ($request, $user, $shouldDirectPublish) {
            $categoryId = $request->category_id ?: PostCategory::where('is_active', true)->value('id');

            $post = PostRequest::create([
                'title' => $request->title,
                'slug' => Str::slug($request->title) . '-' . Str::random(6),
                'caption_narrative' => $request->caption_narrative,
                'category_id' => $categoryId,
                'department_id' => $user->department_id ?: $user->id,
                'requestor_id' => $user->id,
                'status' => $shouldDirectPublish ? PostRequest::STATUS_APPROVED : PostRequest::STATUS_PENDING_OFFICE_HEAD,
                'target_platforms' => $request->target_platforms ?: ['facebook'],
                'revision_count' => 0,
            ]);

            // Handle image download if provided
            if ($request->image_url) {
                $this->attachImageFromUrl($post, $request->image_url);
            }

            return $post;
        });

        // If direct publishing requested, execute AutoPublishJob synchronously
        $publishedRecords = [];
        if ($shouldDirectPublish) {
            try {
                AutoPublishJob::dispatchSync($post, $user->id);
                $post->refresh();
                $publishedRecords = PublishingRecord::where('post_request_id', $post->id)->get();

                AuditLogService::log(
                    'AGENT_DIRECT_PUBLISHED',
                    "Agent published post #{$post->id} ('{$post->title}') directly to platforms.",
                    'INFO',
                    ['post_id' => $post->id, 'platforms' => $post->target_platforms]
                );
            } catch (\Throwable $e) {
                AuditLogService::log(
                    'AGENT_PUBLISH_FAILED',
                    "Agent direct publish failed for post #{$post->id}: {$e->getMessage()}",
                    'ERROR',
                    ['post_id' => $post->id, 'error' => $e->getMessage()]
                );
            }
        } else {
            AuditLogService::log(
                'AGENT_POST_CREATED',
                "Agent created post draft #{$post->id} ('{$post->title}')",
                'INFO',
                ['post_id' => $post->id]
            );
        }

        return response()->json([
            'status' => 'success',
            'message' => $shouldDirectPublish ? 'Post created and published directly.' : 'Post created successfully and submitted to approval workflow.',
            'data' => [
                'post' => $post->load(['category:id,name', 'media']),
                'publishing_records' => $publishedRecords,
            ],
        ], 201);
    }

    /**
     * Update an existing post.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $post = PostRequest::find($id);
        if (!$post) {
            return response()->json(['status' => 'error', 'message' => "Post #{$id} not found."], 404);
        }

        $request->validate([
            'title' => 'nullable|string|max:255',
            'caption_narrative' => 'nullable|string',
            'category_id' => 'nullable|exists:post_categories,id',
            'target_platforms' => 'nullable|array',
        ]);

        $updates = array_filter($request->only([
            'title',
            'caption_narrative',
            'category_id',
            'target_platforms',
        ]), fn($v) => !is_null($v));

        if (!empty($updates)) {
            $post->update($updates);
            AuditLogService::log(
                'AGENT_POST_UPDATED',
                "Agent updated post #{$post->id} ('{$post->title}')",
                'INFO',
                ['post_id' => $post->id, 'updated_fields' => array_keys($updates)]
            );
        }

        return response()->json([
            'status' => 'success',
            'message' => "Post #{$id} updated successfully.",
            'data' => $post->refresh()->load('category:id,name'),
        ]);
    }

    /**
     * Delete a post.
     */
    public function destroy(int $id): JsonResponse
    {
        $post = PostRequest::find($id);
        if (!$post) {
            return response()->json(['status' => 'error', 'message' => "Post #{$id} not found."], 404);
        }

        $title = $post->title;
        $post->delete();

        AuditLogService::log(
            'AGENT_POST_DELETED',
            "Agent deleted post #{$id} ('{$title}')",
            'WARNING',
            ['post_id' => $id, 'title' => $title]
        );

        return response()->json([
            'status' => 'success',
            'message' => "Post #{$id} has been deleted successfully.",
        ]);
    }

    /**
     * Force publish an existing post directly to Facebook & Instagram.
     */
    public function publish(Request $request, int $id): JsonResponse
    {
        $post = PostRequest::find($id);
        if (!$post) {
            return response()->json(['status' => 'error', 'message' => "Post #{$id} not found."], 404);
        }

        $user = $request->user();
        if (!$user->hasAnyRole(['it_publisher', 'it_admin'])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Direct publishing is restricted to IT Admin or IT Publisher privileges.',
            ], 403);
        }

        $post->update(['status' => PostRequest::STATUS_APPROVED]);
        AutoPublishJob::dispatchSync($post, $user->id);
        $post->refresh();

        $records = PublishingRecord::where('post_request_id', $post->id)->get();

        AuditLogService::log(
            'AGENT_DIRECT_PUBLISHED',
            "Agent executed direct publish command for existing post #{$post->id}.",
            'INFO',
            ['post_id' => $post->id]
        );

        return response()->json([
            'status' => 'success',
            'message' => "Post #{$id} direct publication initiated.",
            'data' => [
                'post' => $post,
                'publishing_records' => $records,
            ],
        ]);
    }

    /**
     * Get recent security alerts and system warnings.
     */
    public function securityAlerts(Request $request): JsonResponse
    {
        $query = AuditLog::whereIn('severity', ['WARNING', 'ERROR', 'CRITICAL'])
            ->orWhereIn('event_type', ['LOGIN_LOCKED', 'SECURITY_ALERT', 'ATTACK_DETECTED', 'UNAUTHORIZED_ACCESS', 'PUBLISH_FAILED']);

        if ($request->filled('severity')) {
            $query->where('severity', strtoupper($request->severity));
        }

        $limit = min((int) $request->input('limit', 20), 100);
        $alerts = $query->orderBy('created_at', 'desc')->take($limit)->get();

        return response()->json([
            'status' => 'success',
            'count' => $alerts->count(),
            'data' => $alerts,
        ]);
    }

    /**
     * Check system health and platform connectivity.
     */
    public function systemHealth(): JsonResponse
    {
        $fbConfigured = !empty(SystemSetting::where('key', 'facebook_page_id')->value('value')) || !empty(env('FACEBOOK_PAGE_ID'));
        $igConfigured = !empty(SystemSetting::where('key', 'instagram_business_account_id')->value('value')) || !empty(env('INSTAGRAM_BUSINESS_ACCOUNT_ID'));

        return response()->json([
            'status' => 'healthy',
            'timestamp' => now()->toIso8601String(),
            'environment' => config('app.env'),
            'database' => DB::connection()->getPdo() ? 'connected' : 'disconnected',
            'platforms' => [
                'facebook' => $fbConfigured ? 'connected' : 'unconfigured',
                'instagram' => $igConfigured ? 'connected' : 'unconfigured',
            ],
            'posts_summary' => [
                'total' => PostRequest::count(),
                'published' => PostRequest::where('status', PostRequest::STATUS_PUBLISHED)->count(),
                'pending' => PostRequest::whereIn('status', [
                    PostRequest::STATUS_PENDING_OFFICE_HEAD,
                    PostRequest::STATUS_PENDING_VICE_PRESIDENT,
                    PostRequest::STATUS_PENDING_PRESIDENT,
                    PostRequest::STATUS_PENDING_IMC_QA,
                ])->count(),
            ],
        ]);
    }

    /**
     * Return OpenAPI 3.0 specification for ChatGPT, Codex, Antigravity, and other agents.
     */
    public function openApi(): JsonResponse
    {
        $serverUrl = config('app.url', 'https://postflow.jmc.edu.ph');

        return response()->json([
            'openapi' => '3.0.3',
            'info' => [
                'title' => 'JMCFI PostFlow Agent API',
                'description' => 'Secure REST API for AI Agents (ChatGPT, Antigravity, Codex, Hermes, Telegram) to perform CRUD, inspect security logs, and bypass approval workflows for direct institutional publishing.',
                'version' => '1.0.0',
            ],
            'servers' => [
                ['url' => rtrim($serverUrl, '/') . '/api', 'description' => 'PostFlow Live Production API'],
            ],
            'components' => [
                'securitySchemes' => [
                    'BearerAuth' => [
                        'type' => 'http',
                        'scheme' => 'bearer',
                        'bearerFormat' => 'SanctumToken',
                        'description' => 'Enter your Developer API Token generated from PostFlow Admin Dashboard.',
                    ],
                ],
            ],
            'security' => [
                ['BearerAuth' => []],
            ],
            'paths' => [
                '/agent/posts' => [
                    'get' => [
                        'summary' => 'List posts',
                        'description' => 'Retrieve paginated post requests with optional filtering by status or search keyword.',
                        'operationId' => 'listPosts',
                        'parameters' => [
                            ['name' => 'search', 'in' => 'query', 'schema' => ['type' => 'string'], 'description' => 'Search keyword in title or narrative'],
                            ['name' => 'status', 'in' => 'query', 'schema' => ['type' => 'string'], 'description' => 'Filter by status (e.g. published, approved, pending_office_head)'],
                            ['name' => 'per_page', 'in' => 'query', 'schema' => ['type' => 'integer', 'default' => 15]],
                        ],
                        'responses' => [
                            '200' => ['description' => 'List of posts retrieved successfully'],
                        ],
                    ],
                    'post' => [
                        'summary' => 'Create a post or publish directly',
                        'description' => 'Create a new post request. Set bypass_approval or direct_publish to true to bypass approval workflow and immediately publish to Facebook & Instagram.',
                        'operationId' => 'createPost',
                        'requestBody' => [
                            'required' => true,
                            'content' => [
                                'application/json' => [
                                    'schema' => [
                                        'type' => 'object',
                                        'required' => ['title', 'caption_narrative'],
                                        'properties' => [
                                            'title' => ['type' => 'string', 'example' => 'Graduation Rehearsal Announcement'],
                                            'caption_narrative' => ['type' => 'string', 'example' => 'Attention students: Graduation rehearsal is scheduled for Friday at 9:00 AM.'],
                                            'category_id' => ['type' => 'integer', 'example' => 1],
                                            'target_platforms' => [
                                                'type' => 'array',
                                                'items' => ['type' => 'string'],
                                                'example' => ['facebook', 'instagram'],
                                            ],
                                            'image_url' => ['type' => 'string', 'format' => 'uri', 'example' => 'https://example.com/banner.png'],
                                            'bypass_approval' => ['type' => 'boolean', 'description' => 'Set to true to skip approval steps and publish immediately', 'example' => true],
                                            'direct_publish' => ['type' => 'boolean', 'description' => 'Alias for bypass_approval', 'example' => true],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        'responses' => [
                            '201' => ['description' => 'Post created or published successfully'],
                            '403' => ['description' => 'Forbidden if token lacks IT Admin permissions for direct publishing'],
                        ],
                    ],
                ],
                '/agent/posts/{id}' => [
                    'get' => [
                        'summary' => 'Get post details',
                        'operationId' => 'getPostDetails',
                        'parameters' => [
                            ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']],
                        ],
                        'responses' => [
                            '200' => ['description' => 'Post details returned'],
                            '404' => ['description' => 'Post not found'],
                        ],
                    ],
                    'put' => [
                        'summary' => 'Update post',
                        'operationId' => 'updatePost',
                        'parameters' => [
                            ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']],
                        ],
                        'requestBody' => [
                            'content' => [
                                'application/json' => [
                                    'schema' => [
                                        'type' => 'object',
                                        'properties' => [
                                            'title' => ['type' => 'string'],
                                            'caption_narrative' => ['type' => 'string'],
                                            'target_platforms' => ['type' => 'array', 'items' => ['type' => 'string']],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        'responses' => [
                            '200' => ['description' => 'Post updated'],
                        ],
                    ],
                    'delete' => [
                        'summary' => 'Delete post',
                        'operationId' => 'deletePost',
                        'parameters' => [
                            ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']],
                        ],
                        'responses' => [
                            '200' => ['description' => 'Post deleted'],
                        ],
                    ],
                ],
                '/agent/posts/{id}/publish' => [
                    'post' => [
                        'summary' => 'Force direct publish',
                        'description' => 'Publish an existing draft or approved post directly to connected social platforms.',
                        'operationId' => 'directPublishPost',
                        'parameters' => [
                            ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']],
                        ],
                        'responses' => [
                            '200' => ['description' => 'Publication initiated'],
                        ],
                    ],
                ],
                '/agent/security-alerts' => [
                    'get' => [
                        'summary' => 'Check security alerts and hacker activity',
                        'description' => 'Inspect login lockouts, unauthorized tampering, server exceptions, and intruder logs.',
                        'operationId' => 'getSecurityAlerts',
                        'parameters' => [
                            ['name' => 'limit', 'in' => 'query', 'schema' => ['type' => 'integer', 'default' => 20]],
                            ['name' => 'severity', 'in' => 'query', 'schema' => ['type' => 'string', 'enum' => ['WARNING', 'ERROR', 'CRITICAL']]],
                        ],
                        'responses' => [
                            '200' => ['description' => 'Recent alerts returned'],
                        ],
                    ],
                ],
                '/agent/system-health' => [
                    'get' => [
                        'summary' => 'Check system health',
                        'operationId' => 'getSystemHealth',
                        'responses' => [
                            '200' => ['description' => 'Health and platform status returned'],
                        ],
                    ],
                ],
            ],
        ]);
    }

    /**
     * Download and attach an image from an external URL safely.
     */
    private function attachImageFromUrl(PostRequest $post, string $imageUrl): void
    {
        try {
            $response = Http::withOptions(['allow_redirects' => false])
                ->timeout(15)
                ->get($imageUrl);

            $contentType = strtolower(trim(explode(';', (string) $response->header('Content-Type'))[0]));
            $extension = self::ALLOWED_IMAGE_TYPES[$contentType] ?? null;
            $bytes = strlen($response->body());

            if (!$response->successful() || !$extension || $bytes > self::MAX_IMAGE_BYTES) {
                return;
            }

            $filename = 'agent_' . Str::random(10) . '.' . $extension;
            $path = 'post-media/' . $post->id . '/' . $filename;

            Storage::disk('public')->put($path, $response->body());

            PostMedia::create([
                'post_request_id' => $post->id,
                'file_name' => $filename,
                'file_path' => $path,
                'file_type' => $contentType,
                'file_size' => $bytes,
                'is_featured' => true,
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("Agent image attach failed: {$e->getMessage()}");
        }
    }

    /**
     * SSRF Protection: Ensure external image URL is not targeting internal networks.
     */
    private function assertSafeImageUrl(string $url): void
    {
        $parts = parse_url($url);
        $scheme = strtolower($parts['scheme'] ?? '');
        $host   = $parts['host'] ?? '';

        if (!in_array($scheme, ['http', 'https'], true)) {
            throw new \InvalidArgumentException('image_url must use http or https.');
        }

        if (empty($host)) {
            throw new \InvalidArgumentException('image_url must have a valid hostname.');
        }

        if (in_array(strtolower($host), ['localhost', '127.0.0.1', '::1', '0.0.0.0', 'railway.internal'], true)
            || str_ends_with(strtolower($host), '.internal')
            || str_ends_with(strtolower($host), '.local')) {
            throw new \InvalidArgumentException('image_url host is not permitted.');
        }

        $ips = @dns_get_record($host, DNS_A + DNS_AAAA);
        if (empty($ips)) {
            $ip = @gethostbyname($host);
            $ips = ($ip && $ip !== $host) ? [['ip' => $ip]] : [];
        }

        if (empty($ips)) {
            throw new \InvalidArgumentException('image_url host could not be resolved.');
        }

        foreach ($ips as $record) {
            $ip = $record['ip'] ?? $record['ipv6'] ?? null;
            if (!$ip) continue;

            $flags = FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE;
            if (filter_var($ip, FILTER_VALIDATE_IP, $flags) === false) {
                throw new \InvalidArgumentException('image_url resolves to a private or reserved IP address.');
            }
        }
    }
}
