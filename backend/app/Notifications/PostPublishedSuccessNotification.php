<?php

namespace App\Notifications;

use App\Models\PostRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PostPublishedSuccessNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public PostRequest $postRequest,
        public array $publishResults = []
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

        $userName = $notifiable->first_name ?: $notifiable->full_name ?: 'System Administrator';

        $tableDetails = [
            'Title'               => $this->postRequest->title,
            'Category'            => $categoryName,
            'Published Platforms' => $targetPlatformsFormatted,
            'Published At'        => now()->format('M d, Y h:i A'),
        ];

        $fbPostId  = $this->publishResults['facebook']['id'] ?? null;
        $wpLink    = $this->publishResults['wordpress']['link'] ?? null;

        if ($fbPostId && $fbPostId !== 'mock_fb_post_12345') {
            $tableDetails['Facebook Post ID'] = $fbPostId;
        }
        if (!empty($wpLink)) {
            $tableDetails['WordPress Article'] = $wpLink;
        }

        $frontendUrl = config('app.frontend_url', 'http://localhost:8081');
        $dashboardUrl = rtrim($frontendUrl, '/') . "/dashboard/it-admin";

        $viewData = [
            'statusBadge'     => 'PUBLISHED — SOCIAL MEDIA',
            'statusType'      => 'published',
            'greeting'        => "Hello {$userName},",
            'bodyMessage'     => 'The following post has been successfully published to the target institutional platforms.',
            'tableDetails'    => $tableDetails,
            'actionUrl'       => $dashboardUrl,
            'buttonText'      => 'View in Dashboard',
            'footerText'      => '© 2026 Jose Maria College Foundation, Inc. All rights reserved.',
        ];

        return (new MailMessage)
            ->subject("[JMCFI PostFlow] ✅ Published Successfully — {$this->postRequest->title}")
            ->view('emails.custom-template', $viewData);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type'            => 'post_published_success',
            'post_request_id' => $this->postRequest->id,
            'post_title'      => $this->postRequest->title,
            'publish_results' => $this->publishResults,
            'message'         => "Post '{$this->postRequest->title}' was published successfully",
        ];
    }
}
