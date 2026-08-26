<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PublishingRecord;
use App\Models\PostRequest;
use App\Models\User;
use App\Notifications\PostPublishedSuccessNotification;
use App\Notifications\PostPublishingFailedNotification;
use App\Services\FacebookPublishingService;
use App\Services\InstagramPublishingService;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Exception;

class PublishingController extends Controller
{
    public function __construct(
        private FacebookPublishingService $facebookService,
        private InstagramPublishingService $instagramService,
        private AuditLogService $auditLogService
    ) {}

    public function publish(Request $request, PostRequest $post): JsonResponse
    {
        $user = $request->user();

        // 1. Validate that the user is the publisher (IT Admin)
        if (!$user->hasAnyRole(['it_publisher', 'it_admin'])) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only IT Admin can publish.'
            ], 403);
        }

        // 2. Validate that the post is ready to be published (must be approved or scheduled)
        if (!in_array($post->status, [PostRequest::STATUS_APPROVED, PostRequest::STATUS_SCHEDULED])) {
            return response()->json([
                'success' => false,
                'message' => 'Post cannot be published. Current status is ' . $post->status
            ], 422);
        }

        try {
            DB::beginTransaction();

            $platforms = is_string($post->target_platforms) ? json_decode($post->target_platforms, true) : $post->target_platforms;
            if (!is_array($platforms)) {
                $platforms = [];
            }
            $lowerPlatforms = array_map('strtolower', $platforms);

            $publishResults = [];
            $publishErrors = [];
            $media = $post->media()
                ->where(function ($query) {
                    $query->where('type', 'image')
                        ->orWhere('mime_type', 'like', 'image/%');
                })
                ->orderBy('sort_order')
                ->first();

            if (in_array('instagram', $lowerPlatforms) || in_array('ig', $lowerPlatforms)) {
                try {
                    $message = $post->caption_narrative ?? '';
                    $imageUrl = $this->instagramImageUrl($media);
                    $igResponse = $this->instagramService->publishPost($message, $imageUrl);
                    $publishResults['instagram'] = $igResponse;
                } catch (Exception $e) {
                    $publishErrors['instagram'] = $this->friendlyPublishError($e->getMessage());
                    \Illuminate\Support\Facades\Log::error('Publish to Instagram failed: ' . $e->getMessage());
                }
            }

            // 3. Publish to Facebook if it is in the target platforms
            if (in_array('facebook', $lowerPlatforms) || in_array('fb', $lowerPlatforms)) {
                $mediaPath = null;
                if ($media && $media->file_path) {
                    $disk = config('filesystems.default');
                    if ($disk === 's3' || $disk === 'b2') {
                        $mediaPath = $media->url;
                    } else {
                        $mediaPath = \Illuminate\Support\Facades\Storage::disk('public')->path($media->file_path);
                    }
                }

                $message = $post->caption_narrative ?? '';
                try {
                    $fbResponse = $this->facebookService->publishPost($message, $mediaPath);
                    $publishResults['facebook'] = $fbResponse;
                } catch (Exception $e) {
                    $publishErrors['facebook'] = $this->friendlyPublishError($e->getMessage());
                    \Illuminate\Support\Facades\Log::error('Publish to Facebook failed: ' . $e->getMessage());
                }
            }

            if ($publishResults === []) {
                $post->update(['status' => PostRequest::STATUS_PUBLISH_FAILED]);
                throw new Exception($this->formatPublishErrors($publishErrors));
            }

            // 4. Update the post status to published
            $post->update([
                'status' => PostRequest::STATUS_PUBLISHED,
                'published_at' => now(),
            ]);

            $this->recordPublishingResults($post, $user->id, $publishResults, $publishErrors);

            // 5. Log the action in Audit Trail
            \App\Services\AuditLogService::log(
                'POST_PUBLISHED',
                "Published request \"{$post->title}\" to selected platforms.",
                'INFO',
                [
                    'postId'    => $post->id,
                    'platforms' => $platforms,
                    'results'   => $publishResults,
                    'errors'    => $publishErrors,
                ]
            );

            DB::commit();

            // Notify IT Admins of manual publish success
            $itAdmins = User::whereHas('roles', fn($q) => $q->whereIn('name', ['it_publisher', 'it_admin']))
                ->where('status', 'active')->get();
            if ($itAdmins->isNotEmpty()) {
                Notification::send($itAdmins, new PostPublishedSuccessNotification($post, $publishResults));
            }

            return response()->json([
                'success' => true,
                'message' => $publishErrors === []
                    ? 'Post published successfully.'
                    : 'Post published to available platforms. Some platforms need attention: ' . $this->formatPublishErrors($publishErrors),
                'data'    => [
                    'post'    => $post,
                    'results' => $publishResults,
                    'errors'  => $publishErrors,
                ]
            ]);

        } catch (Exception $e) {
            DB::rollBack();

            try {
                if ($post->status !== PostRequest::STATUS_PUBLISHED) {
                    $post->update(['status' => PostRequest::STATUS_PUBLISH_FAILED]);
                }
            } catch (Exception $statusEx) {
                \Illuminate\Support\Facades\Log::error('Failed to mark post as publish_failed: ' . $statusEx->getMessage());
            }

            // Notify IT Admins of failure
            try {
                $itAdmins = User::whereHas('roles', fn($q) => $q->whereIn('name', ['it_publisher', 'it_admin']))
                    ->where('status', 'active')->get();
                if ($itAdmins->isNotEmpty()) {
                    Notification::send($itAdmins, new PostPublishingFailedNotification($post, $e->getMessage()));
                }
            } catch (Exception $notifyEx) {
                \Illuminate\Support\Facades\Log::error('Failed to send failure notification: ' . $notifyEx->getMessage());
            }

            return response()->json([
                'success' => false,
                'message' => 'Failed to publish post: ' . $e->getMessage()
            ], 500);
        }
    }

    public function schedule(Request $request, PostRequest $post): JsonResponse
    {
        $user = $request->user();

        if (!$user->hasRole('it_publisher')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        if ($post->status !== PostRequest::STATUS_APPROVED) {
            return response()->json(['success' => false, 'message' => 'Only approved posts can be scheduled.'], 422);
        }

        $post->update(['status' => PostRequest::STATUS_SCHEDULED]);

        $this->auditLogService->log(
            $user,
            'POST_SCHEDULED',
            "Scheduled request \"{$post->title}\" for publishing.",
            request()->ip(),
            request()->header('User-Agent'),
            'INFO'
        );

        return response()->json([
            'success' => true,
            'message' => 'Post scheduled successfully.',
            'data' => $post
        ]);
    }

    private function instagramImageUrl($media): ?string
    {
        if (!$media) {
            return null;
        }

        return route('instagram.media', ['media' => $media->id]);
    }

    private function recordPublishingResults(PostRequest $post, int $userId, array $results, array $errors): void
    {
        foreach ($results as $platform => $response) {
            PublishingRecord::create([
                'post_request_id' => $post->id,
                'published_by' => $userId,
                'platform' => $platform,
                'external_post_id' => $this->externalPostId($platform, $response),
                'external_url' => $this->externalPostUrl($platform, $response),
                'status' => 'published',
                'published_at' => now(),
                'platform_response' => $response,
            ]);
        }

        foreach ($errors as $platform => $message) {
            PublishingRecord::create([
                'post_request_id' => $post->id,
                'published_by' => $userId,
                'platform' => $platform,
                'status' => 'failed',
                'published_at' => now(),
                'error_message' => $message,
            ]);
        }
    }

    private function externalPostId(string $platform, array $response): ?string
    {
        return match ($platform) {
            'instagram' => $response['id'] ?? data_get($response, 'response.id'),
            'facebook' => $response['post_id'] ?? $response['id'] ?? null,
            default => $response['id'] ?? null,
        };
    }

    private function externalPostUrl(string $platform, array $response): ?string
    {
        if (!empty($response['permalink'])) {
            return $response['permalink'];
        }

        $id = $this->externalPostId($platform, $response);
        if (!$id) {
            return null;
        }

        return match ($platform) {
            'facebook' => str_contains($id, '_') ? 'https://www.facebook.com/' . str_replace('_', '/posts/', $id) : null,
            default => null,
        };
    }

    private function formatPublishErrors(array $errors): string
    {
        if ($errors === []) {
            return 'No platform was selected or no platform returned a successful response.';
        }

        return collect($errors)
            ->map(fn ($message, $platform) => ucfirst((string) $platform) . ': ' . $message)
            ->implode(' ');
    }

    private function friendlyPublishError(string $message): string
    {
        $jsonStart = strpos($message, '{');
        $decoded = json_decode($jsonStart === false ? $message : substr($message, $jsonStart), true);
        $metaMessage = data_get($decoded, 'error.message', $message);
        $code = data_get($decoded, 'error.code');

        if ($code === 190 || str_contains(strtolower($metaMessage), 'access token')) {
            return 'The saved Meta token is invalid or expired. Open Platform Tokens, paste a fresh Page Access Token, then click Save & Validate Publishing Setup.';
        }

        if ($code === 200 || str_contains(strtolower($metaMessage), 'publish_actions')) {
            return 'The Page token is missing pages_manage_posts. Regenerate the Meta token with pages_manage_posts, pages_read_engagement, pages_show_list, instagram_basic, and instagram_content_publish, then save it in Platform Tokens.';
        }

        return $metaMessage;
    }
}
