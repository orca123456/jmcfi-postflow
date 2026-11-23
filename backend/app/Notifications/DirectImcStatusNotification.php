<?php

namespace App\Notifications;

use App\Models\PostRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class DirectImcStatusNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public PostRequest $postRequest,
        public string $action, // 'submitted', 'reviewing', 'editing', 'scheduled', 'resubmitted'
        public ?string $actorName = null,
        public ?string $customMessage = null,
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['database'];
        $defaultMailer = config('mail.default');
        if (in_array($defaultMailer, ['log', 'array', 'sendgrid', 'resend'])) {
            $channels[] = 'mail';
        } elseif ($defaultMailer === 'smtp' && !empty(config('mail.mailers.smtp.username')) && !empty(config('mail.mailers.smtp.password'))) {
            $channels[] = 'mail';
        }
        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $greetingName = $notifiable->first_name ?: $notifiable->full_name ?: 'User';
        $greeting = "Hello {$greetingName},";

        $categoryName = $this->postRequest->category?->name
            ?? $this->postRequest->other_category_name
            ?? 'Direct to IMC';

        $rawPlatforms = $this->postRequest->target_platforms ?? ['facebook', 'instagram'];
        if (is_string($rawPlatforms)) {
            $rawPlatforms = json_decode($rawPlatforms, true) ?: [$rawPlatforms];
        }
        $targetPlatformsFormatted = !empty($rawPlatforms)
            ? implode(', ', array_map(fn($p) => ucfirst(strtolower((string)$p)), (array)$rawPlatforms))
            : 'Facebook, Instagram';

        $title = $this->postRequest->title;
        $actor = $this->actorName ?: 'IMC Team';

        switch ($this->action) {
            case 'submitted':
                $statusBadge = 'DIRECT IMC — SUBMITTED';
                $statusType = 'pending';
                $subject = "[JMCFI PostFlow] Direct IMC Request Submitted — {$title}";
                $bodyMessage = "Your Direct IMC content request has been submitted and is currently in queue for IMC review.";
                break;

            case 'reviewing':
                $statusBadge = 'DIRECT IMC — IN REVIEW';
                $statusType = 'pending';
                $subject = "[JMCFI PostFlow] IMC is Reviewing Your Request — {$title}";
                $bodyMessage = "{$actor} from Integrated Marketing Communications has opened and is currently reviewing your submitted materials.";
                break;

            case 'editing':
                $statusBadge = 'DIRECT IMC — PREPARING GRAPHICS';
                $statusType = 'pending';
                $subject = "[JMCFI PostFlow] IMC is Preparing Your Publication — {$title}";
                $bodyMessage = "{$actor} from IMC is actively preparing final publication graphics and copy for your content request.";
                break;

            case 'scheduled':
                $statusBadge = 'DIRECT IMC — SCHEDULED';
                $statusType = 'approved';
                $schedStr = $this->postRequest->preferred_schedule_at 
                    ? \Carbon\Carbon::parse($this->postRequest->preferred_schedule_at)->setTimezone('Asia/Manila')->format('F j, Y \a\t g:i A') . ' (PHT)'
                    : 'the requested date';
                $subject = "[JMCFI PostFlow] Direct IMC Request Scheduled — {$title}";
                $bodyMessage = "Your Direct IMC content request has been finalized by IMC and is scheduled to be published on {$schedStr}.";
                break;

            case 'resubmitted':
                $statusBadge = 'DIRECT IMC — RESUBMITTED';
                $statusType = 'pending';
                $subject = "[JMCFI PostFlow] Direct IMC Request Resubmitted — {$title}";
                $bodyMessage = "The requestor has updated and resubmitted the Direct IMC request for review.";
                break;

            default:
                $statusBadge = 'DIRECT IMC — STATUS UPDATE';
                $statusType = 'pending';
                $subject = "[JMCFI PostFlow] Direct IMC Request Update — {$title}";
                $bodyMessage = $this->customMessage ?: "There is an update on your Direct IMC request.";
                break;
        }

        $tableDetails = [
            'Title'            => $title,
            'Category'         => $categoryName,
            'Target Platforms' => $targetPlatformsFormatted,
            'Status'           => ucwords(str_replace('_', ' ', $this->action)),
        ];

        $frontendUrl = config('app.frontend_url', 'http://localhost:8081');
        $actionUrl = rtrim($frontendUrl, '/') . "/dashboard/requestor?postId={$this->postRequest->id}";

        $viewData = [
            'statusBadge'     => $statusBadge,
            'statusType'      => $statusType,
            'greeting'        => $greeting,
            'bodyMessage'     => $bodyMessage,
            'tableDetails'    => $tableDetails,
            'actionUrl'       => $actionUrl,
            'buttonText'      => 'View Request Details',
            'footerText'      => '© 2026 Jose Maria College Foundation, Inc. All rights reserved.',
        ];

        return (new MailMessage)
            ->subject($subject)
            ->view('emails.custom-template', $viewData);
    }

    public function toArray(object $notifiable): array
    {
        $message = match ($this->action) {
            'submitted' => "Your Direct IMC request '{$this->postRequest->title}' was submitted and is awaiting IMC review.",
            'reviewing' => "IMC is currently reviewing your Direct IMC request '{$this->postRequest->title}'.",
            'editing' => "IMC is preparing and editing final materials for '{$this->postRequest->title}'.",
            'scheduled' => "Your Direct IMC request '{$this->postRequest->title}' has been scheduled for publishing.",
            'resubmitted' => "Direct IMC request '{$this->postRequest->title}' has been resubmitted with updates.",
            default => $this->customMessage ?: "Update on Direct IMC request '{$this->postRequest->title}'",
        };

        return [
            'type'            => 'direct_imc_' . $this->action,
            'post_request_id' => $this->postRequest->id,
            'post_title'      => $this->postRequest->title,
            'routing_type'    => 'direct_imc',
            'action'          => $this->action,
            'actor_name'      => $this->actorName,
            'message'         => $message,
        ];
    }
}
