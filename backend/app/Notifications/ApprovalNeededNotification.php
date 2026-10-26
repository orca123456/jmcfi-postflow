<?php

namespace App\Notifications;

use App\Models\Department;
use App\Models\PostRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ApprovalNeededNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public PostRequest $postRequest,
        public ?string $forStage = null
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $stage = $this->forStage ?? $this->postRequest->currentApprovalStage()?->stage ?? 'office_head';

        $approverFirstName = $notifiable->first_name ?: $notifiable->full_name;

        // Resolve Category
        $categoryName = $this->postRequest->category?->name
            ?? $this->postRequest->other_category_name
            ?? 'Announcement';

        // Resolve Target Platforms formatted
        $rawPlatforms = $this->postRequest->target_platforms ?? ['facebook', 'instagram'];
        if (is_string($rawPlatforms)) {
            $rawPlatforms = json_decode($rawPlatforms, true) ?: [$rawPlatforms];
        }
        $targetPlatformsFormatted = !empty($rawPlatforms)
            ? implode(', ', array_map(fn($p) => ucfirst(strtolower((string)$p)), (array)$rawPlatforms))
            : 'Facebook, Instagram';

        // Resolve Requestor and Department
        $requestor = $this->postRequest->requestor;
        $requestorName = $requestor?->full_name ?? 'April Joy Domopoy';
        $deptRaw = $requestor?->department;

        $deptCode = $deptRaw ?: 'BSA';
        $deptName = $deptRaw ?: 'Accountancy';

        if ($deptRaw) {
            $deptModel = Department::where('name', $deptRaw)->orWhere('display_name', $deptRaw)->first();
            if ($deptModel) {
                $deptCode = $deptModel->name;
                $deptName = match($deptModel->name) {
                    'BSA'   => 'Accountancy',
                    'Psyc'  => 'Psychology',
                    default => $deptModel->display_name ?: $deptModel->name,
                };
            }
        }

        // Configure Stage Specifics matching screenshots
        switch ($stage) {
            case 'office_head':
                $greeting = $approverFirstName ? "Hello Department Head {$approverFirstName}," : "Hello Department Head,";
                $bodyMessage = "A new post request from your department requires your review.";
                $subject = "[JMCFI PostFlow] Action Required — Department Head Approval: {$this->postRequest->title}";
                $tableDetails = [
                    'Title'            => $this->postRequest->title,
                    'Category'         => $categoryName,
                    'Submitted by'     => "{$requestorName} ({$deptCode})",
                    'Target Platforms' => $targetPlatformsFormatted,
                ];
                break;

            case 'vice_president':
                $greeting = "Hello Vice President,";
                $bodyMessage = "A new post request has been forwarded for your approval.";
                $subject = "[JMCFI PostFlow] Action Required — Vice President Approval: {$this->postRequest->title}";
                $tableDetails = [
                    'Title'            => $this->postRequest->title,
                    'Category'         => $categoryName,
                    'Submitted by'     => $requestorName,
                    'Department'       => $deptName,
                    'Target Platforms' => $targetPlatformsFormatted,
                ];
                break;

            case 'imc_qa':
            default:
                $greeting = $approverFirstName ? "Hello IMC {$approverFirstName}," : "Hello IMC,";
                $bodyMessage = "A new post request has been forwarded for your final approval.";
                $subject = "[JMCFI PostFlow] Action Required — IMC Final Approval: {$this->postRequest->title}";
                $tableDetails = [
                    'Title'            => $this->postRequest->title,
                    'Category'         => $categoryName,
                    'Submitted by'     => $requestorName,
                    'Department'       => $deptName,
                    'Target Platforms' => $targetPlatformsFormatted,
                ];
                break;
        }

        $frontendUrl = config('app.frontend_url', 'http://localhost:8081');
        $actionUrl = rtrim($frontendUrl, '/') . "/approver/posts/{$this->postRequest->id}";

        $viewData = [
            'statusBadge'     => 'ACTION REQUIRED — POST APPROVAL',
            'statusType'      => 'pending',
            'greeting'        => $greeting,
            'bodyMessage'     => $bodyMessage,
            'tableDetails'    => $tableDetails,
            'actionUrl'       => $actionUrl,
            'buttonText'      => 'Review & Take Action',
            'footerText'      => '© 2026 Jose Maria College Foundation, Inc. All rights reserved.',
        ];

        return (new MailMessage)
            ->subject($subject)
            ->view('emails.custom-template', $viewData);
    }

    public function toArray(object $notifiable): array
    {
        $stage = $this->forStage ?? $this->postRequest->currentApprovalStage()?->stage;
        return [
            'type'            => 'approval_needed',
            'post_request_id' => $this->postRequest->id,
            'post_title'      => $this->postRequest->title,
            'stage'           => $stage,
            'message'         => "Approval needed for '{$this->postRequest->title}'",
        ];
    }
}