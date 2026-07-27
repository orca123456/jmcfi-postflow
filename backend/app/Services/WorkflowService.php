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
        $stages = [
            ['stage' => 'office_head', 'stage_order' => 1],
            ['stage' => 'vice_president', 'stage_order' => 2],
            ['stage' => 'imc_qa', 'stage_order' => 3],
        ];

        foreach ($stages as $index => $stage) {
            $approver = $this->getApproverForStage($stage['stage']);
            if ($approver) {
                ApprovalWorkflow::create([
                    'post_request_id' => $postRequest->id,
                    'stage' => $stage['stage'],
                    'approver_id' => $approver->id,
                    'action' => 'pending',
                    'stage_order' => $stage['stage_order'],
                ]);
            }
        }
    }

    private function getApproverForStage(string $stage): ?User
    {
        $roleMap = [
            'office_head' => 'office_head',
            'vice_president' => 'vice_president',
            'imc_qa' => 'imc_qa_checker',
        ];

        $role = $roleMap[$stage] ?? null;
        if (!$role) return null;

        // Get first active user with this role
        return User::role($role)->where('status', 'active')->first();
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
            'office_head' => 'Office Head',
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