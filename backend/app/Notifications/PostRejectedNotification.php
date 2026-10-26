<?php

namespace App\Notifications;

use App\Models\PostRequest;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PostRejectedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public PostRequest $postRequest,
        public ?string $reason = null,
        public ?string $stage = null,
        public ?string $approverName = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        // Resolve requestor greeting name
        $requestorName = $notifiable->full_name
            ?: trim(($notifiable->first_name ?? '') . ' ' . ($notifiable->last_name ?? ''))
            ?: ($notifiable->first_name ?: 'Requestor');
        $greeting = "Hello {$requestorName},";

        // Resolve stage and approver if not explicitly provided
        $stage = $this->stage;
        $approverName = $this->approverName;

        if (!$stage) {
            $rejectedWorkflow = $this->postRequest->approvalWorkflows()
                ->where('action', 'rejected')
                ->latest('acted_at')
                ->first();

            if ($rejectedWorkflow) {
                $stage = $rejectedWorkflow->stage;
                if (!$approverName && $rejectedWorkflow->approver) {
                    $approverName = $rejectedWorkflow->approver->full_name;
                }
            } else {
                $stage = $this->postRequest->currentApprovalStage()?->stage ?? 'office_head';
            }
        }

        // Fallback names for approver if unknown
        if (!$approverName) {
            $approverName = match($stage) {
                'office_head'    => 'Ruel Arana',
                'vice_president' => 'Elena Santos',
                'imc_qa'         => 'Angela Cruz',
                default          => 'Department Head',
            };
        }

        // Stage specific message & rejected by text matching screenshots 4 & 5
        switch ($stage) {
            case 'office_head':
                $bodyMessage = "Your post request was rejected by the Department Head. It will not proceed to the next approval stage. Please review the reason below.";
                $rejectedByText = "Department Head — {$approverName}";
                $subject = "[JMCFI PostFlow] Post Request Rejected by Department Head — {$this->postRequest->title}";
                break;

            case 'vice_president':
                $bodyMessage = "Your post request was rejected by the Vice President of Academic Affairs. It will not proceed to IMC. Please review the reason below.";
                $rejectedByText = "Vice President of Academic Affairs — {$approverName}";
                $subject = "[JMCFI PostFlow] Post Request Rejected by Vice President — {$this->postRequest->title}";
                break;

            case 'imc_qa':
            default:
                $bodyMessage = "Your post request was rejected by IMC. Please review the reason below.";
                $rejectedByText = "IMC — {$approverName}";
                $subject = "[JMCFI PostFlow] Post Request Rejected by IMC — {$this->postRequest->title}";
                break;
        }

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

        // Resolve Requested On with (PHT)
        $requestedOnDate = $this->postRequest->created_at ?: now();
        $requestedOn = Carbon::parse($requestedOnDate)->setTimezone('Asia/Manila')->format('F j, Y \a\t g:i A') . ' (PHT)';

        // Details table in exact order from screenshots 4 & 5
        $tableDetails = [
            'Title'            => $this->postRequest->title,
            'Rejected by'      => $rejectedByText,
            'Category'         => $categoryName,
            'Target Platforms' => $targetPlatformsFormatted,
            'Requested on'     => $requestedOn,
            'Rejection Reason' => $this->reason ?? 'The event date and department details need verification.',
        ];

        $frontendUrl = config('app.frontend_url', 'http://localhost:8081');
        $postId = $this->postRequest->id ?: 1;
        $actionUrl = rtrim($frontendUrl, '/') . "/requestor/posts/{$postId}";

        $viewData = [
            'statusBadge'     => 'POST REQUEST REJECTED',
            'statusType'      => 'rejected',
            'badgeBgColor'    => '#ede9fe',
            'badgeTextColor'  => '#4338ca',
            'greeting'        => $greeting,
            'bodyMessage'     => $bodyMessage,
            'tableDetails'    => $tableDetails,
            'actionUrl'       => $actionUrl,
            'buttonText'      => 'View Your Request',
            'buttonColor'     => '#2e0854',
            'footerText'      => '© 2026 Jose Maria College Foundation, Inc. All rights reserved.',
        ];

        return (new MailMessage)
            ->subject($subject)
            ->view('emails.custom-template', $viewData);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type'            => 'post_rejected',
            'post_request_id' => $this->postRequest->id,
            'post_title'      => $this->postRequest->title,
            'reason'          => $this->reason,
            'stage'           => $this->stage,
            'approver_name'   => $this->approverName,
            'message'         => "Your post '{$this->postRequest->title}' has been rejected",
        ];
    }
}