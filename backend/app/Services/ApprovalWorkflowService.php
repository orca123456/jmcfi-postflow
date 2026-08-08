<?php

namespace App\Services;

use App\Models\PostRequest;
use App\Models\User;
use App\Notifications\PostApprovedNotification;
use App\Notifications\PostRejectedNotification;
use App\Notifications\PostReturnedForRevisionNotification;
use Illuminate\Support\Facades\Log;
use Spatie\Permission\Exceptions\RoleDoesNotExist;

class ApprovalWorkflowService
{
    public function initializeWorkflow(PostRequest $postRequest): void
    {
        $stages = [
            ['stage' => 'office_head', 'order' => 1],
            ['stage' => 'vice_president', 'order' => 2],
            ['stage' => 'imc_qa', 'order' => 3],
        ];

        foreach ($stages as $index => $stage) {
            $approver = $this->getApproverForStage($stage['stage'], $postRequest);
            
            if ($approver) {
                $postRequest->approvalWorkflows()->create([
                    'stage' => $stage['stage'],
                    'approver_id' => $approver->id,
                    'action' => $index === 0 ? 'pending' : 'pending',
                    'stage_order' => $stage['order'],
                ]);
            }
        }
    }

    public function getApproverForStage(string $stage, ?PostRequest $postRequest = null): ?User
    {
        $departmentMap = [
            'vice_president' => 'Vice President of Academic Affairs',
            'imc_qa' => 'Institutional Marketing Communication',
        ];

        try {
            if ($stage === 'office_head') {
                // For office_head stage, find an approver in the same department as the requestor
                $requestorDept = $postRequest?->requestor?->department;
                if (!$requestorDept) {
                    return null;
                }
                return User::whereHas('roles', function ($query) {
                    $query->where('name', 'approver');
                })->where('department', $requestorDept)
                  ->where('status', 'active')
                  ->first();
            }

            $department = $departmentMap[$stage] ?? null;
            if (!$department) {
                return null;
            }

            return User::whereHas('roles', function ($query) {
                $query->where('name', 'approver');
            })->where('department', $department)
              ->where('status', 'active')
              ->first();
        } catch (\Exception $e) {
            Log::warning("Failed to get approver for stage: {$stage}. Error: " . $e->getMessage());
            return null;
        }
    }

    public function notifyApprovers(PostRequest $postRequest): void
    {
        $firstStage = $postRequest->approvalWorkflows()
            ->where('stage_order', 1)
            ->first();

        if ($firstStage && $firstStage->approver_id) {
            $approver = User::find($firstStage->approver_id);
            if ($approver) {
                $approver->notify(new \App\Notifications\ApprovalNeededNotification($postRequest));
            }
        }
    }

    public function notifyNextApprover(PostRequest $postRequest, string $nextStage): void
    {
        $approval = $postRequest->approvalWorkflows()
            ->where('stage', $nextStage)
            ->first();

        if ($approval && $approval->approver_id) {
            $approver = User::find($approval->approver_id);
            if ($approver) {
                $approver->notify(new \App\Notifications\ApprovalNeededNotification($postRequest));
            }
        }
    }

    public function notifyITPublisher(PostRequest $postRequest): void
    {
        try {
            $publisher = User::whereHas('roles', function ($query) {
                $query->where('name', 'admin');
            })->where('department', 'Information Technology Office')
              ->where('status', 'active')
              ->first();

            if ($publisher) {
                $publisher->notify(new \App\Notifications\PostReadyForPublishingNotification($postRequest));
            }
        } catch (\Exception $e) {
            Log::warning("Failed to notify IT publisher. Error: " . $e->getMessage());
        }
    }

    public function notifyRequestor(PostRequest $postRequest, string $action, string $reason): void
    {
        $requestor = $postRequest->requestor;

        switch ($action) {
            case 'rejected':
                $requestor->notify(new PostRejectedNotification($postRequest, $reason));
                break;
            case 'returned_for_revision':
                $requestor->notify(new PostReturnedForRevisionNotification($postRequest, $reason, []));
                break;
            case 'approved':
                $requestor->notify(new PostApprovedNotification($postRequest));
                break;
        }
    }
}