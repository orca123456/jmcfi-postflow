<?php

namespace App\Notifications;

use App\Models\PostRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class PostPublishedSuccessNotification extends Notification
{
    use Queueable, SerializesModels;

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
        try {
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

            // Safely parse platform results whether stored as array, JSON string, or null
            $fbData = $this->publishResults['facebook'] ?? null;
            if (is_string($fbData)) {
                $fbData = json_decode($fbData, true) ?: [];
            }
            $fbPostId = is_array($fbData) ? ($fbData['id'] ?? null) : null;

            $wpData = $this->publishResults['wordpress'] ?? null;
            if (is_string($wpData)) {
                $wpData = json_decode($wpData, true) ?: [];
            }
            $wpLink = is_array($wpData) ? ($wpData['link'] ?? null) : null;

            if ($fbPostId && $fbPostId !== 'mock_fb_post_12345') {
                $tableDetails['Facebook Post ID'] = $fbPostId;
            }
            if (!empty($wpLink)) {
                $tableDetails['WordPress Article'] = $wpLink;
            }

            $frontendUrl = env('RAILWAY_PUBLIC_DOMAIN')
                ? 'https://' . rtrim(env('RAILWAY_PUBLIC_DOMAIN'), '/')
                : (config('app.frontend_url') ?: config('app.url') ?: 'https://postflow.jmc.edu.ph');
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
        } catch (\Throwable $e) {
            Log::error("PostPublishedSuccessNotification::toMail failed for post ID {$this->postRequest->id}: {$e->getMessage()}");
            throw $e;
        }
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
