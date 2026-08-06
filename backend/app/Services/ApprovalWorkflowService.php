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
            $approver = $this->getApproverForStage($stage['stage']);
            
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

    public function getApproverForStage(string $stage): ?User
    {
        $roleMap = [
            'office_head' => 'office_head',
            'vice_president' => 'vice_president',
            'imc_qa' => 'imc_qa_checker',
            'it_publisher' => 'it_publisher',
        ];

        $role = $roleMap[$stage] ?? null;
        
        if (!$role) {
            return null;
        }

        try {
            // Get the first active user with this role
            return User::whereHas('roles', function ($query) use ($role) {
                $query->where('name', $role);
            })->where('status', 'active')->first();
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
                $query->where('name', 'it_publisher');
            })->where('status', 'active')->first();

            if ($publisher) {
                $publisher->notify(new \App\Notifications\PostReadyForPublishingNotification($postRequest));
            }
        } catch (RoleDoesNotExist $e) {
            Log::warning("Role 'it_publisher' does not exist in the database. Skipping publisher notification.");
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