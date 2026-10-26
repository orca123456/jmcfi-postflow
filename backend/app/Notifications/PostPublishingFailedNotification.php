<?php

namespace App\Notifications;

use App\Models\PostRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PostPublishingFailedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public PostRequest $postRequest,
        public string $errorMessage = ''
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $rawPlatforms = $this->postRequest->target_platforms ?? ['facebook', 'instagram'];
        if (is_string($rawPlatforms)) {
            $rawPlatforms = json_decode($rawPlatforms, true) ?: [$rawPlatforms];
        }
        $targetPlatformsFormatted = !empty($rawPlatforms)
            ? implode(', ', array_map(fn($p) => ucfirst(strtolower((string)$p)), (array)$rawPlatforms))
            : 'Facebook, Instagram';

        $categoryName = $this->postRequest->category?->name
            ?? $this->postRequest->other_category_name
            ?? 'Announcement';

        $userName = $notifiable->first_name ?: $notifiable->full_name ?: 'Administrator';

        $tableDetails = [
            'Title'            => $this->postRequest->title,
            'Category'         => $categoryName,
            'Target Platforms' => $targetPlatformsFormatted,
            'Failed At'        => now()->format('M d, Y h:i A'),
            'Error Reason'     => $this->errorMessage ?: 'Social platform API returned an unexpected error.',
        ];

        $frontendUrl = config('app.frontend_url', 'http://localhost:8081');
        $dashboardUrl = rtrim($frontendUrl, '/') . "/dashboard/it-admin";

        $viewData = [
            'statusBadge'     => 'FAILED — PUBLISHING ERROR',
            'statusType'      => 'failed',
            'greeting'        => "Hello {$userName},",
            'bodyMessage'     => 'The system encountered an error while broadcasting this post to the configured platforms. Please check platform tokens and publish manually.',
            'tableDetails'    => $tableDetails,
            'actionUrl'       => $dashboardUrl,
            'buttonText'      => 'Open Dashboard & Resolve',
            'footerText'      => '© 2026 Jose Maria College Foundation, Inc. All rights reserved.',
        ];

        return (new MailMessage)
            ->subject("[JMCFI PostFlow] 🚨 URGENT: Failed to Publish — {$this->postRequest->title}")
            ->view('emails.custom-template', $viewData);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type'            => 'post_publishing_failed',
            'post_request_id' => $this->postRequest->id,
            'post_title'      => $this->postRequest->title,
            'error_message'   => $this->errorMessage,
            'message'         => "⚠️ Failed to publish '{$this->postRequest->title}': {$this->errorMessage}",
        ];
    }
}
