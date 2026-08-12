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
                    $response = Http::get($request->image_url);
                    if ($response->successful()) {
                        $extension = 'jpg'; // Basic fallback
                        $contentType = $response->header('Content-Type');
                        if (str_contains($contentType, 'png')) $extension = 'png';
                        if (str_contains($contentType, 'jpeg')) $extension = 'jpg';

                        $filename = 'external_' . Str::random(10) . '.' . $extension;
                        $path = 'post-media/' . $post->id . '/' . $filename;
                        
                        Storage::disk(config('filesystems.default'))->put($path, $response->body());

                        $media = PostMedia::create([
                            'post_request_id' => $post->id,
                            'type' => 'image',
                            'original_name' => basename($request->image_url),
                            'file_path' => $path,
                            'mime_type' => $contentType ?? 'image/jpeg',
                            'file_size' => strlen($response->body()),
                            'sort_order' => 0,
                            'is_featured' => true,
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

}
