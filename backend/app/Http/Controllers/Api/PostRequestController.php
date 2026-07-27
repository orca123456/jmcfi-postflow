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
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            $user = $request->user();
            $role = $user->getRoleNames()->first();
            $stageMap = [
                'office_head' => 'pending_office_head',
                'vice_president' => 'pending_vice_president',
                'president' => 'pending_president',
                'imc_qa_checker' => 'pending_imc_qa',
            ];
            if (isset($stageMap[$role])) {
                $query->where('status', $stageMap[$role]);
            }
        }

        // Hide rejected/returned posts from VP and IMC, only Admin and Requestor see them
        if (!$request->has('my_requests')) {
            $user = $request->user();
            $role = $user->getRoleNames()->first();
            
            if (in_array($role, ['vice_president', 'imc_qa_checker', 'president'])) {
                $query->where(function ($q) use ($user) {
                    $q->whereNotIn('status', ['draft', 'returned_for_revision', 'rejected'])
                      ->orWhereHas('approvalWorkflows', function ($aw) use ($user) {
                          $aw->where('approver_id', $user->id)
                             ->whereIn('action', ['rejected', 'returned_for_revision']);
                      });
                });
            } elseif ($role === 'office_head') {
                $query->whereNotIn('status', ['draft']);
            }
        }

        // Sort
        $sortBy = $request->get('sort_by', 'created_at');
        $sortDir = $request->get('sort_dir', 'desc');
        $query->orderBy($sortBy, $sortDir);

        // Paginate
        $perPage = min($request->get('per_page', 15), 100);
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
        return DB::transaction(function () use ($request) {
            $post = PostRequest::create([
                'title' => $request->title,
                'slug' => Str::slug($request->title) . '-' . Str::random(6),
                'caption_narrative' => $request->caption_narrative,
                'category_id' => $request->category_id,
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
                    $path = $file->store('post-media/' . $post->id, 'public');
                    PostMedia::create([
                        'post_request_id' => $post->id,
                        'type' => $this->getMediaType($file->getMimeType()),
                        'original_name' => $file->getClientOriginalName(),
                        'file_path' => $path,
                        'mime_type' => $file->getMimeType(),
                        'file_size' => $file->getSize(),
                        'sort_order' => $index,
                        'is_featured' => $index === 0,
                    ]);
                }
            }

            // Handle supporting documents
            if ($request->hasFile('supporting_docs')) {
                foreach ($request->file('supporting_docs') as $index => $file) {
                    $path = $file->store('post-supporting-docs/' . $post->id, 'public');
                    PostMedia::create([
                        'post_request_id' => $post->id,
                        'type' => 'document',
                        'original_name' => $file->getClientOriginalName(),
                        'file_path' => $path,
                        'mime_type' => $file->getMimeType(),
                        'file_size' => $file->getSize(),
                        'sort_order' => 100 + $index,
                        'is_featured' => false,
                    ]);
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

            return response()->json([
                'data' => new PostRequestResource($post->load([
                    'category', 'requestor', 'media', 'approvalWorkflows.approver'
                ])),
                'message' => $request->is_draft ? 'Post saved as draft' : 'Post submitted for approval',
            ], 201);
        });
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
                    Storage::disk('public')->delete($media->path);
                    $media->delete();
                });

                // Add new media
                $existingCount = $postRequest->media()->whereIn('id', $keepIds)->count();
                foreach ($request->file('media') as $index => $file) {
                    $path = $file->store('post-media/' . $postRequest->id, 'public');
                    PostMedia::create([
                        'post_request_id' => $postRequest->id,
                        'type' => $this->getMediaType($file->getMimeType()),
                        'original_name' => $file->getClientOriginalName(),
                        'file_path' => $path,
                        'mime_type' => $file->getMimeType(),
                        'file_size' => $file->getSize(),
                        'sort_order' => $existingCount + $index,
                        'is_featured' => ($existingCount + $index) === 0,
                    ]);
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
            Storage::disk('public')->delete($media->path);
        }

        $postRequest->delete();

        return response()->json(['message' => 'Post deleted successfully']);
    }

    public function submitForApproval(PostRequest $postRequest): JsonResponse
    {
        if (!$postRequest->canBeEditedBy(request()->user())) {
            return response()->json(['message' => 'Cannot submit this post'], 403);
        }

        if ($postRequest->status !== PostRequest::STATUS_DRAFT && $postRequest->status !== PostRequest::STATUS_RETURNED_FOR_REVISION) {
            return response()->json(['message' => 'Post cannot be submitted for approval in current status'], 400);
        }

        return DB::transaction(function () use ($postRequest) {
            $postRequest->update([
                'status' => PostRequest::STATUS_PENDING_OFFICE_HEAD,
            ]);

            $this->workflowService->initializeWorkflow($postRequest);
            $this->aiService->checkCompliance($postRequest);
            $this->workflowService->notifyApprovers($postRequest);

            return response()->json([
                'data' => new PostRequestResource($postRequest->load([
                    'category', 'requestor', 'media', 'approvalWorkflows.approver'
                ])),
                'message' => 'Post submitted for approval',
            ]);
        });
    }

    public function approve(Request $request, PostRequest $postRequest): JsonResponse
    {
        $user = $request->user();

        if (!$postRequest->canBeApprovedBy($user)) {
            return response()->json(['message' => 'Unauthorized to approve this post'], 403);
        }

        return DB::transaction(function () use ($request, $postRequest, $user) {
            $currentStage = $postRequest->currentApprovalStage();
            $nextStage = $postRequest->getNextStage();

            $currentStage->update([
                'action' => 'approved',
                'approver_id' => $user->id,
                'remarks' => $request->remarks,
                'acted_at' => now(),
            ]);

            if ($nextStage) {
                // Move to next stage
                $statusMap = [
                    'office_head' => PostRequest::STATUS_PENDING_OFFICE_HEAD,
                    'vice_president' => PostRequest::STATUS_PENDING_VICE_PRESIDENT,
                    'imc_qa' => PostRequest::STATUS_PENDING_IMC_QA,
                    'it_publisher' => PostRequest::STATUS_APPROVED,
                ];
                
                $postRequest->update([
                    'status' => $statusMap[$nextStage] ?? PostRequest::STATUS_APPROVED,
                ]);

                // Notify next approver
                $this->workflowService->notifyNextApprover($postRequest, $nextStage);
            } else {
                // All approvals done
                $postRequest->update([
                    'status' => PostRequest::STATUS_APPROVED,
                ]);
                
                // Notify IT Publisher for scheduling/publishing
                $this->workflowService->notifyITPublisher($postRequest);
            }

            // Record audit trail
            AuditLogService::log('CONTENT_APPROVAL', 'Approved post: ' . $postRequest->title, 'INFO', ['post_id' => $postRequest->id, 'remarks' => $request->remarks], $request);

            return response()->json([
                'data' => new PostRequestResource($postRequest->load([
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

    public function getDashboardStats(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $user->getRoleNames()->first();

        $query = PostRequest::query();

        if (in_array($role, ['content_requestor', 'requestor'])) {
            $query->where('requestor_id', $user->id);
        } elseif (in_array($role, ['vice_president', 'imc_qa_checker', 'president'])) {
            $query->where(function ($q) use ($user) {
                $q->whereNotIn('status', ['draft', 'returned_for_revision', 'rejected'])
                  ->orWhereHas('approvalWorkflows', function ($aw) use ($user) {
                      $aw->where('approver_id', $user->id)
                         ->whereIn('action', ['rejected', 'returned_for_revision']);
                  });
            });
        } elseif ($role === 'office_head') {
            $query->whereNotIn('status', ['draft']);
        } elseif (in_array($role, ['it_admin', 'it_publisher'])) {
            $query->whereIn('status', [
                PostRequest::STATUS_APPROVED,
                PostRequest::STATUS_SCHEDULED,
            ]);
        }
        // Admin sees all

        // Total user count (only for admin)
        $totalUsers = 0;
        if ($role === 'admin') {
            $totalUsers = \App\Models\User::count();
        }

        $totalSubmissions = (clone $query)->count();
        $draftCount = (clone $query)->where('status', PostRequest::STATUS_DRAFT)->count();
        $pendingCount = (clone $query)->whereIn('status', [
            PostRequest::STATUS_PENDING_OFFICE_HEAD,
            PostRequest::STATUS_PENDING_VICE_PRESIDENT,
            PostRequest::STATUS_PENDING_PRESIDENT,
            PostRequest::STATUS_PENDING_IMC_QA,
        ])->count();
        $approvedCount = (clone $query)->where('status', PostRequest::STATUS_APPROVED)->count();
        $rejectedCount = (clone $query)->where('status', PostRequest::STATUS_REJECTED)->count();
        $returnedCount = (clone $query)->where('status', PostRequest::STATUS_RETURNED_FOR_REVISION)->count();
        $scheduledCount = (clone $query)->where('status', PostRequest::STATUS_SCHEDULED)->count();
        $publishedCount = (clone $query)->where('status', PostRequest::STATUS_PUBLISHED)->count();

        // Recent post requests for activity feed (last 10)
        $recentPosts = PostRequest::with(['requestor', 'approvalWorkflows.approver'])
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

        $stats = [
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
        ];

        return response()->json(['data' => $stats]);
    }

    private function canView(PostRequest $post, $user): bool
    {
        // Requestor can view their own
        if ($post->requestor_id === $user->id) {
            return true;
        }

        // Approvers can view posts in their stage or later
        $role = $user->getRoleNames()->first();
        $stageMap = [
            'office_head' => ['pending_office_head', 'pending_vice_president', 'pending_president', 'pending_imc_qa', 'approved', 'scheduled', 'published'],
            'vice_president' => ['pending_vice_president', 'pending_president', 'pending_imc_qa', 'approved', 'scheduled', 'published'],
            'president' => ['pending_president', 'pending_imc_qa', 'approved', 'scheduled', 'published'],
            'imc_qa_checker' => ['pending_imc_qa', 'approved', 'scheduled', 'published'],
            'it_publisher' => ['approved', 'scheduled', 'published'],
            'admin' => true, // admin sees all
        ];

        if ($role === 'admin') return true;
        
        return in_array($post->status, $stageMap[$role] ?? []);
    }

    private function getMediaType(string $mimeType): string
    {
        if (str_starts_with($mimeType, 'image/')) return 'image';
        if (str_starts_with($mimeType, 'video/')) return 'video';
        return 'document';
    }

    private function recordAuditTrail(PostRequest $post, string $event, $user, ?string $remarks = null): void
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
}