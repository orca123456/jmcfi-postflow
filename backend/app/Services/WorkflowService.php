<?php

namespace App\Services;

use App\Models\ApprovalWorkflow;
use App\Models\PostRequest;
use App\Models\User;
use App\Notifications\ApprovalNeededNotification;
use App\Notifications\PostApprovedNotification;
use App\Notifications\PostRejectedNotification;
use App\Notifications\PostReturnedForRevisionNotification;
use App\Notifications\ReadyForPublishingNotification;
use Illuminate\Support\Facades\Notification;

class WorkflowService
{
    public function initializeWorkflow(PostRequest $postRequest): void
    {
        $approver = $this->getApproverForStage('office_head', $postRequest);
        if ($approver) {
            ApprovalWorkflow::create([
                'post_request_id' => $postRequest->id,
                'stage' => 'office_head',
                'approver_id' => $approver->id,
                'action' => 'pending',
                'stage_order' => 1,
            ]);
        }
    }

    private function getApproverForStage(string $stage, ?PostRequest $postRequest = null): ?User
    {
        if ($stage === 'office_head') {
            $requestor = $postRequest?->requestor;
            $programHeadId = $postRequest?->program_head_id ?? $requestor?->program_head_id;

            if ($programHeadId) {
                $ph = \App\Models\ProgramHead::find($programHeadId);
                if ($ph && $ph->user_id) {
                    $approver = User::role('office_head')->where('id', $ph->user_id)->where('status', 'active')->first();
                    if ($approver) return $approver;
                }
                $approver = User::role('office_head')->where('program_head_id', $programHeadId)->where('status', 'active')->first();
                if ($approver) return $approver;
            }

            $requestorDept = $requestor?->department;
            if (!$requestorDept) return null;

            return User::role('office_head')->where('department', $requestorDept)->where('status', 'active')->first();
        }

        $roleMap = [
            'vice_president' => 'vice_president',
            'imc_qa' => 'imc_qa_checker',
        ];

        $role = $roleMap[$stage] ?? null;
        if (!$role) return null;

        return User::whereHas('roles', function ($query) use ($role) {
            $query->where('name', $role);
        })->where('status', 'active')->first();
    }

    public function notifyApprovers(PostRequest $postRequest): void
    {
        $currentStage = $postRequest->currentApprovalStage();
        if (!$currentStage) return;

        $approver = $currentStage->approver;
        if ($approver) {
            Notification::send($approver, new ApprovalNeededNotification($postRequest));
        }
    }

    public function notifyNextApprover(PostRequest $postRequest, string $nextStage): void
    {
        $approver = $this->getApproverForStage($nextStage);
        if ($approver) {
            // Create the next workflow stage
            ApprovalWorkflow::create([
                'post_request_id' => $postRequest->id,
                'stage' => $nextStage,
                'approver_id' => $approver->id,
                'action' => 'pending',
                'stage_order' => $this->getStageOrder($nextStage),
            ]);

            Notification::send($approver, new ApprovalNeededNotification($postRequest));
        }
    }

    public function notifyITPublisher(PostRequest $postRequest): void
    {
        $publishers = User::role('it_publisher')->where('status', 'active')->get();
        if ($publishers->isNotEmpty()) {
            Notification::send($publishers, new ReadyForPublishingNotification($postRequest));
        }
    }

    public function notifyRequestor(PostRequest $postRequest, string $action, ?string $reason = null): void
    {
        $requestor = $postRequest->requestor;
        if (!$requestor) return;

        $notificationClass = match ($action) {
            'approved' => PostApprovedNotification::class,
            'rejected' => PostRejectedNotification::class,
            'returned_for_revision' => PostReturnedForRevisionNotification::class,
            default => null,
        };

        if ($notificationClass) {
            Notification::send($requestor, new $notificationClass($postRequest, $reason));
        }
    }

    private function getStageOrder(string $stage): int
    {
        return match ($stage) {
            'office_head' => 1,
            'vice_president' => 2,
            'imc_qa' => 3,
            default => 4,
        };
    }

    public function getWorkflowProgress(PostRequest $postRequest): array
    {
        $stages = [
            'office_head' => 'Department Head',
            'vice_president' => 'Vice President',
            'imc_qa' => 'IMC/QA Checker',
        ];

        $progress = [];
        foreach ($stages as $key => $label) {
            $workflow = $postRequest->approvalWorkflows()->where('stage', $key)->first();
            $progress[] = [
                'stage' => $key,
                'label' => $label,
                'status' => $workflow?->action ?? 'not_started',
                'approver' => $workflow?->approver?->getDisplayNameAttribute(),
                'acted_at' => $workflow?->acted_at,
                'remarks' => $workflow?->remarks,
            ];
        }

        return $progress;
    }
}