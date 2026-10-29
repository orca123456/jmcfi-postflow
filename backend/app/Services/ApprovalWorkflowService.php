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
        try {
            if ($stage === 'office_head') {
                $requestor = $postRequest?->requestor;
                $programHeadId = $postRequest?->program_head_id ?? $requestor?->program_head_id;

                if ($programHeadId) {
                    // 1. Try finding by ProgramHead model's user_id
                    $ph = \App\Models\ProgramHead::find($programHeadId);
                    if ($ph && $ph->user_id) {
                        $approver = User::role('office_head')->where('id', $ph->user_id)->where('status', 'active')->first();
                        if ($approver) {
                            return $approver;
                        }
                    }

                    // 2. Try finding active office_head user with matching program_head_id
                    $approver = User::role('office_head')
                        ->where('program_head_id', $programHeadId)
                        ->where('status', 'active')
                        ->first();
                    if ($approver) {
                        return $approver;
                    }

                    // 3. Try finding by email from ProgramHead record
                    if ($ph && !empty($ph->email)) {
                        $approver = User::role('office_head')
                            ->where('email', $ph->email)
                            ->where('status', 'active')
                            ->first();
                        if ($approver) {
                            return $approver;
                        }
                    }
                }

                // Fallback: Office Head must belong to the requestor's department
                $requestorDept = $requestor?->department;
                if (!$requestorDept) {
                    return null;
                }

                // Prefer an office head in the department who is not assigned to another program head
                $unassignedHead = User::role('office_head')
                    ->where('department', $requestorDept)
                    ->whereNull('program_head_id')
                    ->where('status', 'active')
                    ->first();

                if ($unassignedHead) {
                    return $unassignedHead;
                }

                return User::role('office_head')
                    ->where('department', $requestorDept)
                    ->where('status', 'active')
                    ->first();
            }

            // vice_president / imc_qa — match by ROLE (the old department-map
            // strings like 'Vice President of Academic Affairs' never matched
            // the real department names, and the old 'approver' role lookup
            // matched nobody, so no workflow rows were ever created)
            $roleName = match ($stage) {
                'vice_president' => 'vice_president',
                'imc_qa' => 'imc_qa_checker',
                default => null,
            };
            if (!$roleName) {
                return null;
            }

            $approver = User::role($roleName)
                ->where('status', 'active')
                ->first();

            if ($approver) {
                return $approver;
            }

            // Fallback for stage imc_qa: match active user by Integrated Marketing Communications department
            if ($stage === 'imc_qa') {
                $approver = User::where('status', 'active')
                    ->where(function ($q) {
                        $q->where('department', 'ILIKE', '%Integrated Marketing%')
                          ->orWhere('department', 'ILIKE', '%Institutional Marketing%')
                          ->orWhere('department', 'ILIKE', '%Marketing Communication%')
                          ->orWhere('department', 'ILIKE', '%IMC%');
                    })
                    ->first();

                if ($approver && !$approver->hasRole('imc_qa_checker')) {
                    $approver->assignRole('imc_qa_checker');
                }
            }

            return $approver;
        } catch (\Exception $e) {
            Log::warning("Failed to get approver for stage: {$stage}. Error: " . $e->getMessage());
            return null;
        }
    }

    public function notifyApprovers(PostRequest $postRequest): void
    {
        try {
            $firstStage = $postRequest->approvalWorkflows()
                ->where('stage_order', 1)
                ->first();

            if ($firstStage && $firstStage->approver_id) {
                $approver = User::find($firstStage->approver_id);
                if ($approver) {
                    $approver->notify(new \App\Notifications\ApprovalNeededNotification($postRequest));
                }
            }
        } catch (\Throwable $e) {
            Log::warning("Failed to notify first stage approver. Error: " . $e->getMessage());
        }
    }

    public function notifyNextApprover(PostRequest $postRequest, string $nextStage): void
    {
        try {
            $approval = $postRequest->approvalWorkflows()
                ->where('stage', $nextStage)
                ->first();

            if ($approval && $approval->approver_id) {
                $approver = User::find($approval->approver_id);
                if ($approver) {
                    $approver->notify(new \App\Notifications\ApprovalNeededNotification($postRequest, $nextStage));
                }
            }
        } catch (\Throwable $e) {
            Log::warning("Failed to notify next stage ({$nextStage}) approver. Error: " . $e->getMessage());
        }
    }

    /**
     * Notify the requestor that their post was approved at a specific stage.
     */
    public function notifyRequestorOfStageApproval(PostRequest $postRequest, ?string $stage, ?string $approverName = null): void
    {
        $requestor = $postRequest->requestor;
        if (!$requestor) return;

        try {
            $requestor->notify(new PostApprovedNotification($postRequest, $stage, $approverName));
        } catch (\Throwable $e) {
            Log::warning("Failed to notify requestor of stage approval. Error: " . $e->getMessage());
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
        } catch (\Throwable $e) {
            Log::warning("Failed to notify IT publisher. Error: " . $e->getMessage());
        }
    }

    public function notifyRequestor(PostRequest $postRequest, string $action, string $reason, ?string $stage = null, ?string $approverName = null): void
    {
        $requestor = $postRequest->requestor;
        if (!$requestor) return;

        try {
            switch ($action) {
                case 'rejected':
                    $requestor->notify(new PostRejectedNotification($postRequest, $reason, $stage, $approverName));
                    break;
                case 'returned_for_revision':
                    $requestor->notify(new PostReturnedForRevisionNotification($postRequest, $reason, []));
                    break;
                case 'approved':
                    $requestor->notify(new PostApprovedNotification($postRequest, $stage, $approverName));
                    break;
            }
        } catch (\Throwable $e) {
            Log::warning("Failed to notify requestor of {$action}. Error: " . $e->getMessage());
        }
    }

    /**
     * Send an approval reminder notification to the approver for the active/specified stage.
     */
    public function sendApprovalReminder(PostRequest $postRequest, ?string $stage = null): bool
    {
        try {
            $stage = $stage ?? $postRequest->currentApprovalStage()?->stage ?? 'office_head';
            $approval = $postRequest->approvalWorkflows()
                ->where('stage', $stage)
                ->first();

            if ($approval && $approval->approver_id) {
                $approver = User::find($approval->approver_id);
                if ($approver) {
                    $approver->notify(new \App\Notifications\ApprovalReminderNotification($postRequest, $stage));
                    return true;
                }
            }
        } catch (\Throwable $e) {
            Log::warning("Failed to send approval reminder for post {$postRequest->id}. Error: " . $e->getMessage());
        }
        return false;
    }
}