<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PostRequest;
use App\Services\FacebookPublishingService;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Exception;

class PublishingController extends Controller
{
    public function __construct(
        private FacebookPublishingService $facebookService,
        private AuditLogService $auditLogService
    ) {}

    public function publish(Request $request, PostRequest $post): JsonResponse
    {
        $user = $request->user();

        // 1. Validate that the user is the publisher (IT Admin)
        if (!$user->hasRole('it_admin')) {
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

            // 3. Publish to Facebook if it is in the target platforms
            if (in_array('facebook', $lowerPlatforms) || in_array('fb', $lowerPlatforms)) {
                $media = $post->media()->first();
                $mediaPath = null;
                if ($media && $media->file_path) {
                    $mediaPath = \Illuminate\Support\Facades\Storage::disk('public')->path($media->file_path);
                }

                $message = $post->caption_narrative ?? '';
                $fbResponse = $this->facebookService->publishPost($message, $mediaPath);
                $publishResults['facebook'] = $fbResponse;
            }

            // 4. Update the post status to published
            $post->update(['status' => PostRequest::STATUS_PUBLISHED]);

            // 5. Log the action in Audit Trail
            \App\Services\AuditLogService::log(
                'POST_PUBLISHED',
                "Published request \"{$post->title}\" to selected platforms.",
                'INFO',
                [
                    'postId' => $post->id,
                    'platforms' => $platforms,
                    'results' => $publishResults
                ]
            );

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Post published successfully.',
                'data' => [
                    'post' => $post,
                    'results' => $publishResults
                ]
            ]);

        } catch (Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to publish post: ' . $e->getMessage()
            ], 500);
        }
    }

    public function schedule(Request $request, PostRequest $post): JsonResponse
    {
        $user = $request->user();

        if (!$user->hasRole('it_admin')) {
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
}
