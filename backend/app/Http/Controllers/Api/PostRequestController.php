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
            'aiComplianceCheck',
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
                        'original_filename' => $file->getClientOriginalName(),
                        'stored_filename' => $file->hashName(),
                        'path' => $path,
                        'mime_type' => $file->getMimeType(),
                        'size' => $file->getSize(),
                        'sort_order' => $index,
                        'is_featured' => $index === 0,
                    ]);
                }
            }

            // Create approval workflow stages
            if (!$request->is_draft) {
                $this->workflowService->initializeWorkflow($post);
            }

            // Run AI compliance check if not draft
            if (!$request->is_draft && $request->run_ai_check) {
                $this->aiService->checkCompliance($post);
            }

            // Send notifications to approvers
            if (!$request->is_draft) {
                $this->workflowService->notifyApprovers($post);
            }

            return response()->json([
                'data' => new PostRequestResource($post->load([
                    'category', 'requestor', 'media', 'approvalWorkflows.approver', 'aiComplianceCheck'
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
            'aiComplianceCheck',
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
                        'original_filename' => $file->getClientOriginalName(),
                        'stored_filename' => $file->hashName(),
                        'path' => $path,
                        'mime_type' => $file->getMimeType(),
                        'size' => $file->getSize(),
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
                    'category', 'requestor', 'media', 'approvalWorkflows.approver', 'aiComplianceCheck'
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
                    'category', 'requestor', 'media', 'approvalWorkflows.approver', 'aiComplianceCheck'
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
            $currentStage->update([
                'action' => 'approved',
                'approver_id' => $user->id,
                'remarks' => $request->remarks,
                'acted_at' => now(),
            ]);

            $nextStage = $postRequest->getNextStage();

            if ($nextStage) {
                // Move to next stage
                $statusMap = [
                    'office_head' => PostRequest::STATUS_PENDING_VICE_PRESIDENT,
                    'vice_president' => PostRequest::STATUS_PENDING_PRESIDENT,
                    'president' => PostRequest::STATUS_PENDING_IMC_QA,
                    'imc_qa' => PostRequest::STATUS_APPROVED,
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
            $this->recordAuditTrail($postRequest, 'approved', $user, $request->remarks);

            return response()->json([
                'data' => new PostRequestResource($postRequest->load([
                    'category', 'requestor', 'media', 'approvalWorkflows.approver', 'aiComplianceCheck'
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
            'rejection_reason' => 'required|string',
            'revision_guidance' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($request, $postRequest, $user) {
            $currentStage = $postRequest->currentApprovalStage();
            $currentStage->update([
                'action' => 'rejected',
                'approver_id' => $user->id,
                'remarks' => $request->rejection_reason,
                'acted_at' => now(),
            ]);

            $postRequest->update([
                'status' => PostRequest::STATUS_REJECTED,
                'rejection_reason' => $request->rejection_reason,
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

            $this->recordAuditTrail($postRequest, 'rejected', $user, $request->rejection_reason);
            $this->workflowService->notifyRequestor($postRequest, 'rejected', $request->rejection_reason);

            return response()->json([
                'data' => new PostRequestResource($postRequest->load([
                    'category', 'requestor', 'media', 'approvalWorkflows.approver', 'aiComplianceCheck'
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
            'revision_notes' => 'required|array',
            'rejection_reason' => 'required|string',
        ]);

        return DB::transaction(function () use ($request, $postRequest, $user) {
            $currentStage = $postRequest->currentApprovalStage();
            $currentStage->update([
                'action' => 'returned_for_revision',
                'approver_id' => $user->id,
                'remarks' => $request->rejection_reason,
                'acted_at' => now(),
            ]);

            $postRequest->update([
                'status' => PostRequest::STATUS_RETURNED_FOR_REVISION,
                'rejection_reason' => $request->rejection_reason,
                'revision_notes' => $request->revision_notes,
                'revision_count' => $postRequest->revision_count + 1,
            ]);

            $this->recordAuditTrail($postRequest, 'returned_for_revision', $user, $request->rejection_reason);
            $this->workflowService->notifyRequestor($postRequest, 'returned_for_revision', $request->rejection_reason);

            return response()->json([
                'data' => new PostRequestResource($postRequest->load([
                    'category', 'requestor', 'media', 'approvalWorkflows.approver', 'aiComplianceCheck'
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

        switch ($role) {
            case 'requestor':
                $query->where('requestor_id', $user->id);
                break;
            case 'office_head':
                $query->where('status', PostRequest::STATUS_PENDING_OFFICE_HEAD);
                break;
            case 'vice_president':
                $query->where('status', PostRequest::STATUS_PENDING_VICE_PRESIDENT);
                break;
            case 'president':
                $query->where('status', PostRequest::STATUS_PENDING_PRESIDENT);
                break;
            case 'imc_qa_checker':
                $query->where('status', PostRequest::STATUS_PENDING_IMC_QA);
                break;
            case 'it_publisher':
                $query->where('status', PostRequest::STATUS_APPROVED)
                      ->orWhere('status', PostRequest::STATUS_SCHEDULED);
                break;
            case 'admin':
                // Admin sees all
                break;
        }

        $stats = [
            'total' => (clone $query)->count(),
            'draft' => (clone $query)->where('status', PostRequest::STATUS_DRAFT)->count(),
            'pending' => (clone $query)->whereIn('status', [
                PostRequest::STATUS_PENDING_OFFICE_HEAD,
                PostRequest::STATUS_PENDING_VICE_PRESIDENT,
                PostRequest::STATUS_PENDING_PRESIDENT,
                PostRequest::STATUS_PENDING_IMC_QA,
            ])->count(),
            'approved' => (clone $query)->where('status', PostRequest::STATUS_APPROVED)->count(),
            'rejected' => (clone $query)->where('status', PostRequest::STATUS_REJECTED)->count(),
            'returned_for_revision' => (clone $query)->where('status', PostRequest::STATUS_RETURNED_FOR_REVISION)->count(),
            'scheduled' => (clone $query)->where('status', PostRequest::STATUS_SCHEDULED)->count(),
            'published' => (clone $query)->where('status', PostRequest::STATUS_PUBLISHED)->count(),
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