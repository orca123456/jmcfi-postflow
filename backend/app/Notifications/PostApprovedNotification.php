<?php

namespace App\Notifications;

use App\Models\PostRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PostApprovedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public PostRequest $postRequest,
        public ?string $approvedByStage = null,
        public ?string $approverName = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        // Resolve stage
        $stage = $this->approvedByStage;
        if (!$stage) {
            $latestApproval = $this->postRequest->approvalWorkflows()
                ->where('action', 'approved')
                ->orderByDesc('stage_order')
                ->first();
            $stage = $latestApproval?->stage ?? 'office_head';
            if (!$this->approverName && $latestApproval?->approver) {
                $this->approverName = $latestApproval->approver->full_name;
            }
        }

        // Requestor greeting
        $requestorFirstName = $notifiable->first_name ?: $notifiable->full_name ?: 'Requestor';
        $greeting = "Hello {$requestorFirstName},";

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

        switch ($stage) {
            case 'office_head':
                $statusBadge = 'APPROVED — DEPARTMENT HEAD';
                $bodyMessage = 'Your post request has been approved by the Department Head. It has been forwarded to the Vice President of Academic Affairs for the next review.';
                $approvedByText = 'Department Head — ' . ($this->approverName ?: 'Ruel Arana');
                $subject = "[JMCFI PostFlow] Approved by Department Head — {$this->postRequest->title}";
                break;

            case 'vice_president':
                $statusBadge = 'APPROVED — VPAA';
                $bodyMessage = 'Your post request has been approved by the Vice President of Academic Affairs. It has been forwarded to IMC for final review.';
                $approvedByText = 'Vice President of Academic Affairs — ' . ($this->approverName ?: 'Elena Santos');
                $subject = "[JMCFI PostFlow] Approved by Vice President — {$this->postRequest->title}";
                break;

            case 'imc_qa':
                $statusBadge = 'APPROVED — IMC';
                $bodyMessage = 'Your post request has received final approval from IMC and has been automatically published to its target platforms.';
                $approvedByText = 'IMC — ' . ($this->approverName ?: 'Angela Cruz');
                $subject = "[JMCFI PostFlow] Final Approval by IMC — {$this->postRequest->title}";
                break;

            default:
                $statusBadge = 'APPROVED';
                $bodyMessage = 'Your post request has been approved and has progressed in the review process.';
                $approvedByText = $this->approverName ? "Approver — {$this->approverName}" : 'Approval Authority';
                $subject = "[JMCFI PostFlow] Post Approved — {$this->postRequest->title}";
                break;
        }

        $tableDetails = [
            'Title'            => $this->postRequest->title,
            'Approved by'      => $approvedByText,
            'Category'         => $categoryName,
            'Target Platforms' => $targetPlatformsFormatted,
        ];

        $frontendUrl = config('app.frontend_url', 'http://localhost:8081');
        $actionUrl = rtrim($frontendUrl, '/') . "/requestor/posts/{$this->postRequest->id}";

        $viewData = [
            'statusBadge'     => $statusBadge,
            'statusType'      => 'approved',
            'greeting'        => $greeting,
            'bodyMessage'     => $bodyMessage,
            'tableDetails'    => $tableDetails,
            'actionUrl'       => $actionUrl,
            'buttonText'      => 'View Your Request',
            'footerText'      => '© 2026 Jose Maria College Foundation, Inc. All rights reserved.',
        ];

        return (new MailMessage)
            ->subject($subject)
            ->view('emails.custom-template', $viewData);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type'              => 'post_approved',
            'post_request_id'   => $this->postRequest->id,
            'post_title'        => $this->postRequest->title,
            'approved_by_stage' => $this->approvedByStage,
            'approver_name'     => $this->approverName,
            'message'           => "Your post '{$this->postRequest->title}' has been approved at stage: {$this->approvedByStage}",
        ];
    }
}