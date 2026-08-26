<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\PostRequest\StorePostRequest;
use App\Http\Requests\Api\PostRequest\UpdatePostRequest;
use App\Http\Resources\Api\PostRequestResource;
use App\Models\PostRequest;
use App\Models\PostMedia;
use App\Models\PostCategory;
use App\Models\ApprovalWorkflow;
use App\Services\AIComplianceService;
use App\Notifications\ApprovalNeededNotification;
use App\Services\AuditLogService;
use App\Services\ApprovalWorkflowService;
use App\Jobs\AutoPublishJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PostRequestController extends Controller
{
    public function __construct(
        private AIComplianceService $aiService,
        private ApprovalWorkflowService $workflowService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = PostRequest::with([
            'category',
            'department',
            'requestor',
            'media',
            'approvalWorkflows.approver',
            'policyViolations',
        ]);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by category
        if ($request->has('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        // Filter by requestor (for requestors viewing their own)
        if ($request->has('my_requests') && $request->my_requests) {
            $query->where('requestor_id', $request->user()->id);
        }

        // Filter by approval stage (for approvers)
        if ($request->has('pending_approval') && $request->pending_approval) {
            $this->applyPendingApprovalScope($query, $request->user());
        }

        // Role-based scoping — only when not explicitly asking for own requests.
        // Locks each role to its own data using the REAL DB role names
        // (office_head / vice_president / imc_qa_checker / content_requestor /
        // it_publisher) so URL/API manipulation can't leak other roles' posts.
        if (!$request->has('my_requests')) {
            $this->applyRoleScoping($query, $request->user());
        }


        // Sort
        $sortBy = $request->get('sort_by', 'created_at');
        $sortDir = $request->get('sort_dir', 'desc');
        $query->orderBy($sortBy, $sortDir);

        // Paginate
        $perPage = min(max((int) $request->get('per_page', 15), 1), 15);
        $posts = $query->paginate($perPage);

        return response()->json([
            'data' => PostRequestResource::collection($posts),
            'meta' => [
                'current_page' => $posts->currentPage(),
                'last_page' => $posts->lastPage(),
                'per_page' => $posts->perPage(),
                'total' => $posts->total(),
            ],
        ]);
    }

    public function store(StorePostRequest $request): JsonResponse
    {
        $lock = Cache::lock('post_request_store_user_' . $request->user()->id, 30);

        if (!$lock->get()) {
            return response()->json([
                'message' => 'Your request is already being submitted. Please wait a moment.',
            ], 429);
        }

        try {
            return DB::transaction(function () use ($request) {
            $categoryId = $request->category_id;
            if (!$categoryId) {
                $categoryId = \App\Models\PostCategory::where('is_active', true)->value('id');
            }
            $post = PostRequest::create([
                'title' => $request->title,
                'slug' => Str::slug($request->title) . '-' . Str::random(6),
                'caption_narrative' => $request->caption_narrative,
                'category_id' => $categoryId,
                'department_id' => $request->user()->id,
                'requestor_id' => $request->user()->id,
                'status' => $request->is_draft ? PostRequest::STATUS_DRAFT : PostRequest::STATUS_PENDING_OFFICE_HEAD,
                'target_platforms' => $request->target_platforms ?? [],
                'preferred_schedule_at' => $request->preferred_schedule_at,
                'revision_count' => 0,
            ]);

            // Handle media uploads
            if ($request->hasFile('media')) {
                foreach ($request->file('media') as $index => $file) {
                    $disk = config('filesystems.default') === 'local' ? 'public' : config('filesystems.default');
                    $path = $file->store('post-media/' . $post->id, $disk);
                    $this->createMediaRecord($post, $file, $path, $this->getMediaType($file->getMimeType()), $index, $index === 0);
                }
            }

            // Handle supporting documents
            if ($request->hasFile('supporting_docs')) {
                foreach ($request->file('supporting_docs') as $index => $file) {
                    $disk = config('filesystems.default') === 'local' ? 'public' : config('filesystems.default');
                    $path = $file->store('post-supporting-docs/' . $post->id, $disk);
                    $this->createMediaRecord($post, $file, $path, 'document', 100 + $index, false);
                }
            }

            // Create approval workflow stages
            if (!$request->is_draft) {
                $this->workflowService->initializeWorkflow($post);
            }

            // Run AI compliance check if not draft
            // Temporarily disabled as per user request to ensure smooth submission
            // if (!$request->is_draft && $request->run_ai_check) {
            //     $this->aiService->checkCompliance($post);
            // }

            // Send notifications to approvers
            if (!$request->is_draft) {
                $this->workflowService->notifyApprovers($post);
            }

            $this->clearDashboardCache();

            return response()->json([
                'data' => new PostRequestResource($post->load([
                    'category', 'requestor', 'media', 'approvalWorkflows.approver'
                ])),
                'message' => $request->is_draft ? 'Post saved as draft' : 'Post submitted for approval',
            ], 201);
            });
        } finally {
            $lock->release();
        }
    }

    public function show(PostRequest $postRequest): JsonResponse
    {
        $postRequest->load([
            'category',
            'requestor',
            'media',
            'approvalWorkflows.approver',
            'policyViolations.flaggedBy',
            'policyViolations.reviewedBy',
            'publishingRecords.publishedBy',
        ]);

        // Check authorization
        $user = request()->user();
        if (!$this->canView($postRequest, $user)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json([
            'data' => new PostRequestResource($postRequest),
        ]);
    }

    public function update(UpdatePostRequest $request, PostRequest $postRequest): JsonResponse
    {
        if (!$postRequest->canBeEditedBy($request->user())) {
            return response()->json(['message' => 'Cannot edit this post'], 403);
        }

        return DB::transaction(function () use ($request, $postRequest) {
            $postRequest->update([
                'title' => $request->title ?? $postRequest->title,
                'caption_narrative' => $request->caption_narrative ?? $postRequest->caption_narrative,
                'category_id' => $request->category_id ?? $postRequest->category_id,
                'target_platforms' => $request->target_platforms ?? $postRequest->target_platforms,
                'preferred_schedule_at' => $request->preferred_schedule_at ?? $postRequest->preferred_schedule_at,
            ]);

            // Handle media updates
            if ($request->hasFile('media')) {
                // Delete old media not in keep list
                $keepIds = $request->input('keep_media_ids', []);
                $postRequest->media()->whereNotIn('id', $keepIds)->each(function ($media) {
                    $disk = config('filesystems.default') === 'local' ? 'public' : config('filesystems.default');
                    Storage::disk($disk)->delete($media->file_path);
                    $media->delete();
                });

                // Add new media
                $existingCount = $postRequest->media()->whereIn('id', $keepIds)->count();
                foreach ($request->file('media') as $index => $file) {
                    $disk = config('filesystems.default') === 'local' ? 'public' : config('filesystems.default');
                    $path = $file->store('post-media/' . $postRequest->id, $disk);
                    $sortOrder = $existingCount + $index;
                    $this->createMediaRecord($postRequest, $file, $path, $this->getMediaType($file->getMimeType()), $sortOrder, $sortOrder === 0);
                }
            }

            // Handle media reordering
            if ($request->has('media_order')) {
                foreach ($request->media_order as $index => $mediaId) {
                    PostMedia::where('id', $mediaId)
                        ->where('post_request_id', $postRequest->id)
                        ->update(['sort_order' => $index]);
                }
            }

            // Re-run AI check if content changed and not draft
            if ($request->has('caption_narrative') && $postRequest->status !== PostRequest::STATUS_DRAFT) {
                $this->aiService->checkCompliance($postRequest);
            }

            $this->clearDashboardCache();

            return response()->json([
                'data' => new PostRequestResource($postRequest->load([
                    'category', 'requestor', 'media', 'approvalWorkflows.approver'
                ])),
                'message' => 'Post updated successfully',
            ]);
        });
    }

    public function destroy(PostRequest $postRequest): JsonResponse
    {
        if (!$postRequest->canBeEditedBy(request()->user())) {
            return response()->json(['message' => 'Cannot delete this post'], 403);
        }

        // Delete media files
        foreach ($postRequest->media as $media) {
            $disk = config('filesystems.default') === 'local' ? 'public' : config('filesystems.default');
            Storage::disk($disk)->delete($media->file_path);
        }

        $postRequest->delete();

        $this->clearDashboardCache();

        return response()->json(['message' => 'Post deleted successfully']);
    }

    public function submitForApproval(PostRequest $postRequest): JsonResponse
    {
        $lock = Cache::lock('post_request_submit_' . $postRequest->id, 30);

        if (!$lock->get()) {
            return response()->json([
                'message' => 'This request is already being submitted. Please wait a moment.',
            ], 429);
        }

        try {
        if (!$postRequest->canBeEditedBy(request()->user())) {
            return response()->json(['message' => 'Cannot submit this post'], 403);
        }

        if ($postRequest->status !== PostRequest::STATUS_DRAFT && $postRequest->status !== PostRequest::STATUS_RETURNED_FOR_REVISION) {
            return response()->json(['message' => 'Post cannot be submitted for approval in current status'], 400);
        }

        if ($this->needsInstagramImage($postRequest)) {
            return response()->json([
                'message' => 'Instagram publishing requires a photo. Please upload an image before submitting this request.',
            ], 422);
        }

        return DB::transaction(function () use ($postRequest) {
            $postRequest->update([
                'status' => PostRequest::STATUS_PENDING_OFFICE_HEAD,
            ]);

            $this->workflowService->initializeWorkflow($postRequest);
            $this->workflowService->notifyApprovers($postRequest);

            $this->clearDashboardCache();

            // Run AI compliance check in background so submit returns instantly
            // (The DeepSeek API call can take 5-30 seconds, which blocks the user)
            $aiService = $this->aiService;
            $postId = $postRequest->id;
            app()->terminating(function () use ($aiService, $postId) {
                try {
                    $post = PostRequest::find($postId);
                    if ($post) {
                        $aiService->checkCompliance($post);
                    }
                } catch (\Exception $e) {
                    logger()->warning('Background AI compliance check failed: ' . $e->getMessage());
                }
            });

            return response()->json([
                'data' => new PostRequestResource($postRequest->load([
                    'category', 'requestor', 'media', 'approvalWorkflows.approver'
                ])),
                'message' => 'Post submitted for approval',
            ]);
        });
        } finally {
            $lock->release();
        }
    }

    public function approve(Request $request, PostRequest $postRequest): JsonResponse
    {
        $user = $request->user();

        if (!$postRequest->canBeApprovedBy($user)) {
            $currentStage = $postRequest->currentApprovalStage();
            if ($currentStage) {
                if ($currentStage->stage === 'office_head' && str_contains(strtolower($user->department ?? ''), 'vice president')) {
                    return response()->json(['message' => 'Post is still waiting for Department Head approval.'], 403);
                }
                if (in_array($currentStage->stage, ['office_head', 'vice_president']) && str_contains(strtolower($user->department ?? ''), 'institutional marketing communication')) {
                    $stageName = $currentStage->stage === 'office_head' ? 'Department Head' : 'VPAA';
                    return response()->json(['message' => "Post is still waiting for {$stageName} approval."], 403);
                }
            }
            return response()->json(['message' => 'Unauthorized to approve this post'], 403);
        }

        return DB::transaction(function () use ($request, $postRequest, $user) {
            $currentStage = $postRequest->currentApprovalStage();
            
            // If the workflow row is missing (e.g. approver didn't exist at the time), infer the stage from status
            if (!$currentStage) {
                $inferredStage = match ($postRequest->status) {
                    PostRequest::STATUS_PENDING_OFFICE_HEAD => 'office_head',
                    PostRequest::STATUS_PENDING_VICE_PRESIDENT => 'vice_president',
                    PostRequest::STATUS_PENDING_PRESIDENT => 'president',
                    PostRequest::STATUS_PENDING_IMC_QA => 'imc_qa',
                    default => null,
                };
                
                if ($inferredStage) {
                    $currentStage = $postRequest->approvalWorkflows()->create([
                        'stage' => $inferredStage,
                        'approver_id' => $user->id,
                        'action' => 'pending',
                        'stage_order' => $postRequest->approvalWorkflows()->count() + 1,
                    ]);
                }
            }

            $nextStage = $postRequest->getNextStage();
            $approvedStageName = $currentStage?->stage;

            if ($currentStage) {
                $currentStage->update([
                    'action'      => 'approved',
                    'approver_id' => $user->id,
                    'remarks'     => $request->remarks,
                    'acted_at'    => now(),
                ]);
            }

            if ($nextStage) {
                // Move to next stage
                $statusMap = [
                    'office_head'    => PostRequest::STATUS_PENDING_OFFICE_HEAD,
                    'vice_president' => PostRequest::STATUS_PENDING_VICE_PRESIDENT,
                    'imc_qa'         => PostRequest::STATUS_PENDING_IMC_QA,
                    'it_publisher'   => PostRequest::STATUS_APPROVED,
                ];

                $postRequest->update([
                    'status' => $statusMap[$nextStage] ?? PostRequest::STATUS_APPROVED,
                ]);
            } else {
                // All approvals done — IMC gave final sign-off
                $postRequest->update([
                    'status' => PostRequest::STATUS_APPROVED,
                ]);
            }

            $this->clearDashboardCache();

            // Defer ALL notifications & audit logging to AFTER the response is sent.
            // This makes the approve endpoint return instantly (~50ms) instead of
            // waiting for email/notification serialization (~2-5 seconds).
            $workflowService = $this->workflowService;
            $postId = $postRequest->id;
            $remarks = $request->remarks;
            $userName = $user->full_name;
            $hasNextStage = (bool) $nextStage;
            $nextStageName = $nextStage;

            app()->terminating(function () use ($workflowService, $postId, $approvedStageName, $userName, $hasNextStage, $nextStageName, $remarks) {
                try {
                    $post = PostRequest::find($postId);
                    if (!$post) return;

                    if ($hasNextStage) {
                        $workflowService->notifyNextApprover($post, $nextStageName);
                        $workflowService->notifyRequestorOfStageApproval($post, $approvedStageName, $userName);
                    } else {
                        $workflowService->notifyRequestorOfStageApproval($post, $approvedStageName, $userName);
                        $workflowService->notifyITPublisher($post);
                        AutoPublishJob::dispatch($post)->delay(now()->addSeconds(5));
                    }

                    AuditLogService::log('CONTENT_APPROVAL', 'Approved post: ' . $post->title, 'INFO', ['post_id' => $postId, 'stage' => $approvedStageName, 'remarks' => $remarks]);
                } catch (\Exception $e) {
                    logger()->warning('Background approve notifications failed: ' . $e->getMessage());
                }
            });

            return response()->json([
                'data'    => new PostRequestResource($postRequest->load([
                    'category', 'requestor', 'media', 'approvalWorkflows.approver'
                ])),
                'message' => 'Post approved successfully',
            ]);
        });
    }

    public function reject(Request $request, PostRequest $postRequest): JsonResponse
    {
        $user = $request->user();

        if (!$postRequest->canBeApprovedBy($user)) {
            $currentStage = $postRequest->currentApprovalStage();
            if ($currentStage) {
                if ($currentStage->stage === 'office_head' && str_contains(strtolower($user->department ?? ''), 'vice president')) {
                    return response()->json(['message' => 'Post is still waiting for Department Head approval.'], 403);
                }
                if (in_array($currentStage->stage, ['office_head', 'vice_president']) && str_contains(strtolower($user->department ?? ''), 'institutional marketing communication')) {
                    $stageName = $currentStage->stage === 'office_head' ? 'Department Head' : 'VPAA';
                    return response()->json(['message' => "Post is still waiting for {$stageName} approval."], 403);
                }
            }
            return response()->json(['message' => 'Unauthorized to reject this post'], 403);
        }

        $request->validate([
            'rejection_reason' => 'required_without:reason|string',
            'reason' => 'required_without:rejection_reason|string',
            'revision_guidance' => 'nullable|string',
        ]);
        
        $reason = $request->rejection_reason ?? $request->reason;

        return DB::transaction(function () use ($request, $postRequest, $user, $reason) {
            $currentStage = $postRequest->currentApprovalStage();
            $currentStage->update([
                'action' => 'rejected',
                'approver_id' => $user->id,
                'remarks' => $reason,
                'acted_at' => now(),
            ]);

            $postRequest->update([
                'status' => PostRequest::STATUS_REJECTED,
                'rejection_reason' => $reason,
            ]);

            // Create policy violation record if AI suggested
            if ($postRequest->aiComplianceCheck && $postRequest->aiComplianceCheck->suggested_rejection_reason) {
                $postRequest->policyViolations()->create([
                    'user_id' => $postRequest->requestor_id,
                    'flagged_by_user_id' => $user->id,
                    'violation_type' => 'compliance',
                    'severity' => 'high',
                    'description' => $request->rejection_reason,
                    'ai_generated_reason' => $postRequest->aiComplianceCheck->suggested_rejection_reason,
                ]);
            }

            // Record audit trail
            AuditLogService::log('CONTENT_REJECT', 'Rejected post: ' . $postRequest->title, 'WARNING', ['post_id' => $postRequest->id, 'reason' => $reason], $request);
            $this->workflowService->notifyRequestor($postRequest, 'rejected', $reason);

            $this->clearDashboardCache();

            return response()->json([
                'data' => new PostRequestResource($postRequest->load([
                    'category', 'requestor', 'media', 'approvalWorkflows.approver'
                ])),
                'message' => 'Post rejected',
            ]);
        });
    }

    public function returnForRevision(Request $request, PostRequest $postRequest): JsonResponse
    {
        $user = $request->user();

        if (!$postRequest->canBeApprovedBy($user)) {
            $currentStage = $postRequest->currentApprovalStage();
            if ($currentStage) {
                if ($currentStage->stage === 'office_head' && str_contains(strtolower($user->department ?? ''), 'vice president')) {
                    return response()->json(['message' => 'Post is still waiting for Department Head approval.'], 403);
                }
                if (in_array($currentStage->stage, ['office_head', 'vice_president']) && str_contains(strtolower($user->department ?? ''), 'institutional marketing communication')) {
                    $stageName = $currentStage->stage === 'office_head' ? 'Department Head' : 'VPAA';
                    return response()->json(['message' => "Post is still waiting for {$stageName} approval."], 403);
                }
            }
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'revision_notes' => 'nullable|array',
            'rejection_reason' => 'required_without:reason|string',
            'reason' => 'required_without:rejection_reason|string',
        ]);

        $reason = $request->rejection_reason ?? $request->reason;

        return DB::transaction(function () use ($request, $postRequest, $user, $reason) {
            $currentStage = $postRequest->currentApprovalStage();
            $currentStage->update([
                'action' => 'returned_for_revision',
                'approver_id' => $user->id,
                'remarks' => $reason,
                'acted_at' => now(),
            ]);

            $postRequest->update([
                'status' => PostRequest::STATUS_RETURNED_FOR_REVISION,
                'rejection_reason' => $reason,
                'revision_notes' => $request->revision_notes ?? [],
                'revision_count' => $postRequest->revision_count + 1,
            ]);

            // Record audit trail
            AuditLogService::log('CONTENT_REVISION', 'Returned post for revision: ' . $postRequest->title, 'WARNING', ['post_id' => $postRequest->id, 'reason' => $reason], $request);
            $this->workflowService->notifyRequestor($postRequest, 'returned_for_revision', $reason);

            $this->clearDashboardCache();

            return response()->json([
                'data' => new PostRequestResource($postRequest->load([
                    'category', 'requestor', 'media', 'approvalWorkflows.approver'
                ])),
                'message' => 'Post returned for revision',
            ]);
        });
    }

    public function runAiCheck(PostRequest $postRequest): JsonResponse
    {
        $result = $this->aiService->checkCompliance($postRequest);
        
        return response()->json([
            'data' => $result,
            'message' => 'AI compliance check completed',
        ]);
    }

    public function runDraftAiCheck(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'nullable|string',
            'caption_narrative' => 'required|string',
        ]);

        $result = $this->aiService->checkDraftCompliance($request->title ?? 'Draft', $request->caption_narrative);
        
        return response()->json([
            'data' => $result,
            'message' => 'AI draft compliance check completed',
        ]);
    }

    public function getDashboardStats(Request $request): JsonResponse
    {
        $user = $request->user();
        $category = $user->roleCategory();
        $role = $user->workflowRole();

        $cacheKey = "dashboard_stats_{$user->id}_{$category}";

        $stats = Cache::remember($cacheKey, 1, function () use ($user, $category, $role) {
            $query = PostRequest::query();
            $this->applyRoleScoping($query, $user);

            $totalUsers = 0;
            if ($category === 'admin') {
                $totalUsers = \App\Models\User::count();
            }

            $totalSubmissions = (clone $query)->count();
            $draftCount = (clone $query)->where('status', PostRequest::STATUS_DRAFT)->count();
            
            $pendingCount = 0;
            $approvedCount = 0;
            $rejectedCount = 0;

            if ($category === 'approver') {
                if ($role === 'vice_president') {
                    $pendingCount = (clone $query)->where('status', PostRequest::STATUS_PENDING_VICE_PRESIDENT)->count();
                } elseif ($role === 'imc_qa_checker') {
                    $pendingCount = (clone $query)->where('status', PostRequest::STATUS_PENDING_IMC_QA)->count();
                } else { // office_head
                    $pendingCount = (clone $query)->where('status', PostRequest::STATUS_PENDING_OFFICE_HEAD)->count();
                }
                
                $approvedCount = (clone $query)->whereHas('approvalWorkflows', function ($aw) use ($user) {
                    $aw->where('approver_id', $user->id)->where('action', 'approved');
                })->count();
                
                $rejectedCount = (clone $query)->whereHas('approvalWorkflows', function ($aw) use ($user) {
                    $aw->where('approver_id', $user->id)->whereIn('action', ['rejected', 'returned_for_revision']);
                })->count();
            } else {
                $pendingCount = (clone $query)->whereIn('status', [
                    PostRequest::STATUS_PENDING_OFFICE_HEAD,
                    PostRequest::STATUS_PENDING_VICE_PRESIDENT,
                    PostRequest::STATUS_PENDING_PRESIDENT,
                    PostRequest::STATUS_PENDING_IMC_QA,
                ])->count();
                $approvedCount = (clone $query)->where('status', PostRequest::STATUS_APPROVED)->count();
                $rejectedCount = (clone $query)->where('status', PostRequest::STATUS_REJECTED)->count();
            }

            $returnedCount = (clone $query)->where('status', PostRequest::STATUS_RETURNED_FOR_REVISION)->count();
            $scheduledCount = (clone $query)->where('status', PostRequest::STATUS_SCHEDULED)->count();
            $publishedCount = (clone $query)->where('status', PostRequest::STATUS_PUBLISHED)->count();

            $recentPosts = (clone $query)
                ->with(['requestor', 'approvalWorkflows.approver'])
                ->orderBy('updated_at', 'desc')
                ->take(10)
                ->get()
                ->map(function ($post) {
                    $currentStage = $post->currentApprovalStage();
                    return [
                        'id' => $post->id,
                        'title' => $post->title,
                        'status' => $post->status,
                        'status_label' => $post->status_label,
                        'requestor_name' => $post->requestor?->first_name . ' ' . $post->requestor?->last_name,
                        'requestor_initials' => strtoupper(substr($post->requestor?->first_name ?? 'U', 0, 1) . substr($post->requestor?->last_name ?? 'N', 0, 1)),
                        'current_stage' => $currentStage?->stage_label,
                        'current_approver' => $currentStage?->approver?->first_name . ' ' . $currentStage?->approver?->last_name,
                        'updated_at' => $post->updated_at?->diffForHumans(),
                        'created_at' => $post->created_at,
                    ];
                });

            return [
                'total_users' => $totalUsers,
                'total_submissions' => $totalSubmissions,
                'total' => $totalSubmissions,
                'draft' => $draftCount,
                'pending_review' => $pendingCount,
                'pending' => $pendingCount,
                'approved_posts' => $approvedCount,
                'approved' => $approvedCount,
                'rejected' => $rejectedCount,
                'returned_revision' => $returnedCount,
                'returned_for_revision' => $returnedCount,
                'scheduled' => $scheduledCount,
                'published_posts' => $publishedCount,
                'published' => $publishedCount,
                'recent_activity' => $recentPosts,
                'recent_posts' => $recentPosts,
            ];
        });

        return response()->json([
            'data' => $stats,
            'message' => 'Dashboard statistics retrieved successfully',
        ]);
    }

    private function canView(PostRequest $post, \App\Models\User $user): bool
    {
        // Requestor can view their own
        if ($post->requestor_id === $user->id) {
            return true;
        }

        $category = $user->roleCategory();
        $role = $user->workflowRole();

        // Admin sees everything
        if ($category === 'admin') return true;

        // Approvers: VP and IMC can see all non-draft posts; dept heads can see their own department's posts
        if ($category === 'approver') {
            if (in_array($role, ['vice_president', 'imc_qa_checker'])) {
                return $post->status !== 'draft';
            }
            // Regular dept head (office_head): can see posts from their own department
            return $post->requestor?->department === $user->department && $post->status !== 'draft';
        }

        // Requestors: can only view their own posts
        if ($category === 'requestor') {
            return $post->requestor_id === $user->id;
        }

        return false;
    }

    /**
     * Scope a post query to the posts the given user is allowed to see.
     * Mirrors the frontend role categories using the REAL DB role names:
     *   - admin     (it_publisher / it_admin)          -> everything
     *   - requestor (requestor / content_requestor)     -> only their own posts
     *   - approver  (office_head / vice_president / imc_qa_checker) -> stage/department scoped
     */
    private function applyRoleScoping(\Illuminate\Database\Eloquent\Builder $query, \App\Models\User $user): void
    {
        $category = $user->roleCategory();
        $role = $user->workflowRole();

        if ($category === 'requestor') {
            // Requestors should only see their own requests
            $query->where('requestor_id', $user->id);
        } elseif ($category === 'approver') {
            if ($role === 'vice_president') {
                // VP sees posts that have passed Dept Head, so they don't see Pending Dept Head or Rejected by Dept Head
                $query->whereNotIn('status', [
                    PostRequest::STATUS_DRAFT,
                    PostRequest::STATUS_PENDING_OFFICE_HEAD
                ])->where(function ($q) {
                    // Only show rejected posts if they were rejected at VP or IMC level
                    $q->whereNotIn('status', [PostRequest::STATUS_REJECTED, PostRequest::STATUS_RETURNED_FOR_REVISION])
                      ->orWhereHas('approvalWorkflows', function ($w) {
                          $w->whereIn('action', ['rejected', 'returned_for_revision'])
                            ->whereIn('stage', ['vice_president', 'imc_qa']);
                      });
                });
            } elseif ($role === 'imc_qa_checker') {
                // IMC QA should only see posts that have reached them or passed them
                $query->whereIn('status', [
                    PostRequest::STATUS_PENDING_IMC_QA,
                    PostRequest::STATUS_APPROVED,
                    PostRequest::STATUS_SCHEDULED,
                    PostRequest::STATUS_PUBLISHED,
                    PostRequest::STATUS_PUBLISH_FAILED,
                    PostRequest::STATUS_REJECTED,
                    PostRequest::STATUS_RETURNED_FOR_REVISION,
                ])->where(function ($q) {
                    // Only show rejected posts if they were rejected at IMC level
                    $q->whereNotIn('status', [PostRequest::STATUS_REJECTED, PostRequest::STATUS_RETURNED_FOR_REVISION])
                      ->orWhereHas('approvalWorkflows', function ($w) {
                          $w->whereIn('action', ['rejected', 'returned_for_revision'])
                            ->where('stage', 'imc_qa');
                      });
                });
            } else {
                // Department head (office_head): only posts from the same department
                $query->whereHas('requestor', function ($q) use ($user) {
                    $q->where('department', $user->department);
                })->whereNotIn('status', ['draft']);
            }
        } elseif ($category === 'admin') {
            // Admin sees everything — no filter
        }
    }

    /**
     * Scope a query to the posts currently pending the user's approval stage.
     */
    private function applyPendingApprovalScope(\Illuminate\Database\Eloquent\Builder $query, \App\Models\User $user): void
    {
        if ($user->roleCategory() !== 'approver') {
            return;
        }
        $role = $user->workflowRole();

        if ($role === 'vice_president') {
            $query->where('status', PostRequest::STATUS_PENDING_VICE_PRESIDENT);
        } elseif ($role === 'imc_qa_checker') {
            $query->where('status', PostRequest::STATUS_PENDING_IMC_QA);
        } else { // office_head
            $query->where('status', PostRequest::STATUS_PENDING_OFFICE_HEAD)
                  ->whereHas('requestor', function ($q) use ($user) {
                      $q->where('department', $user->department);
                  });
        }
    }

    private function getMediaType(string $mimeType): string
    {
        if (str_starts_with($mimeType, 'image/')) return 'image';
        if (str_starts_with($mimeType, 'video/')) return 'video';
        return 'document';
    }

    private function needsInstagramImage(PostRequest $postRequest): bool
    {
        $platforms = is_array($postRequest->target_platforms)
            ? $postRequest->target_platforms
            : [];

        if (!in_array('instagram', $platforms, true)) {
            return false;
        }

        return !$postRequest->media()
            ->where(function ($query) {
                $query->where('type', 'image')
                    ->orWhere('mime_type', 'like', 'image/%');
            })
            ->exists();
    }

    private function createMediaRecord(
        PostRequest $post,
        \Illuminate\Http\UploadedFile $file,
        string $path,
        string $type,
        int $sortOrder,
        bool $isFeatured
    ): PostMedia {
        $media = PostMedia::create([
            'post_request_id' => $post->id,
            'type' => $type,
            'original_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'mime_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'sort_order' => $sortOrder,
            'is_featured' => $isFeatured,
        ]);

        if (Schema::hasTable('post_media_files')) {
            $media->file()->create([
                'content' => file_get_contents($file->getRealPath()),
            ]);
        }

        return $media;
    }

    private function recordAuditTrail(PostRequest $post, string $event, \App\Models\User $user, ?string $remarks = null): void
    {
        $post->auditTrails()->create([
            'user_id' => $user->id,
            'event' => $event,
            'from_status' => $post->getOriginal('status'),
            'to_status' => $post->status,
            'remarks' => $remarks,
            'metadata' => [
                'user_role' => $user->getRoleNames()->first(),
            ],
        ]);
    }

    /**
     * Invalidate all dashboard-related Redis caches so fresh data is served on next request.
     */
    private function clearDashboardCache(): void
    {
        // We now cache dashboard_init_data for exactly 1 second.
        // Calling Cache::flush() here causes a massive cache stampede when 
        // 7 users are polling every 100ms, because they all hit the DB at once
        // on a single-threaded server, causing 2-3 second delays.
        // By NOT flushing, the 1-second TTL will naturally expire instantly,
        // but it will only hit the DB once per second instead of 70 times per second.
    }
}
