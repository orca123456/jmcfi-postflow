<?php

namespace App\Notifications;

use App\Models\PostRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PostRejectedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public PostRequest $postRequest,
        public ?string $reason = null
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
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

        $tableDetails = [
            'Title'            => $this->postRequest->title,
            'Category'         => $categoryName,
            'Reason / Notes'   => $this->reason ?? 'No specific reason provided.',
            'Target Platforms' => $targetPlatformsFormatted,
        ];

        $frontendUrl = config('app.frontend_url', 'http://localhost:8081');
        $actionUrl = rtrim($frontendUrl, '/') . "/requestor/posts/{$this->postRequest->id}";

        $viewData = [
            'statusBadge'     => 'REJECTED — POST REQUEST',
            'statusType'      => 'rejected',
            'greeting'        => $greeting,
            'bodyMessage'     => 'Your post request has been reviewed and rejected by the approval authority.',
            'tableDetails'    => $tableDetails,
            'actionUrl'       => $actionUrl,
            'buttonText'      => 'View Your Request',
            'footerText'      => '© 2026 Jose Maria College Foundation, Inc. All rights reserved.',
        ];

        return (new MailMessage)
            ->subject("[JMCFI PostFlow] Post Rejected — {$this->postRequest->title}")
            ->view('emails.custom-template', $viewData);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type'            => 'post_rejected',
            'post_request_id' => $this->postRequest->id,
            'post_title'      => $this->postRequest->title,
            'reason'          => $this->reason,
            'message'         => "Your post '{$this->postRequest->title}' has been rejected",
        ];
    }
}