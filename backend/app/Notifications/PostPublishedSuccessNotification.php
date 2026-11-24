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
        public array $publishResults = [],
        public array $publishErrors = []
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        try {
            $isPartial = !empty($this->publishErrors) || $this->postRequest->status === PostRequest::STATUS_PARTIALLY_PUBLISHED;

            $successfulKeys = array_keys($this->publishResults);
            $failedKeys = array_keys($this->publishErrors);

            $successfulFormatted = !empty($successfulKeys)
                ? implode(', ', array_map(fn($p) => ucfirst(strtolower((string)$p)), $successfulKeys))
                : '';

            $categoryName = $this->postRequest->category?->name
                ?? $this->postRequest->other_category_name
                ?? 'Announcement';

            $userName = $notifiable->first_name ?: $notifiable->full_name ?: 'System Administrator';

            $tableDetails = [
                'Title'    => $this->postRequest->title,
                'Category' => $categoryName,
                'Status'   => $isPartial ? 'Partially Published' : 'Published',
            ];

            if (!empty($successfulFormatted)) {
                $tableDetails['Published Platforms'] = $successfulFormatted;
            }

            if (!empty($failedKeys)) {
                $failedDescriptions = collect($this->publishErrors)->map(function ($msg, $plat) {
                    $platName = ucfirst($plat);
                    $shortMsg = strtok($msg, '.');
                    return "{$platName} ({$shortMsg})";
                })->implode(', ');
                $tableDetails['Failed Platforms'] = $failedDescriptions;
            }

            $tableDetails['Published At'] = now()->format('M d, Y h:i A');

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

            if ($isPartial) {
                $statusBadge = 'PARTIALLY PUBLISHED';
                $statusType = 'warning';
                $subject = "[JMCFI PostFlow] ⚠️ Partially Published — {$this->postRequest->title}";
                $bodyMessage = 'The following post was partially published. Some platforms succeeded while others failed. You can resolve the platform issues and click Retry.';
            } else {
                $statusBadge = 'PUBLISHED — SOCIAL MEDIA';
                $statusType = 'published';
                $subject = "[JMCFI PostFlow] ✅ Published Successfully — {$this->postRequest->title}";
                $bodyMessage = 'The following post has been successfully published to the target institutional platforms.';
            }

            $viewData = [
                'statusBadge'     => $statusBadge,
                'statusType'      => $statusType,
                'greeting'        => "Hello {$userName},",
                'bodyMessage'     => $bodyMessage,
                'tableDetails'    => $tableDetails,
                'actionUrl'       => $dashboardUrl,
                'buttonText'      => 'View in Dashboard',
                'footerText'      => '© 2026 Jose Maria College Foundation, Inc. All rights reserved.',
            ];

            return (new MailMessage)
                ->subject($subject)
                ->view('emails.custom-template', $viewData);
        } catch (\Throwable $e) {
            Log::error("PostPublishedSuccessNotification::toMail failed for post ID {$this->postRequest->id}: {$e->getMessage()}");
            throw $e;
        }
    }

    public function toArray(object $notifiable): array
    {
        $isPartial = !empty($this->publishErrors) || $this->postRequest->status === PostRequest::STATUS_PARTIALLY_PUBLISHED;

        return [
            'type'            => $isPartial ? 'post_partially_published' : 'post_published_success',
            'post_request_id' => $this->postRequest->id,
            'post_title'      => $this->postRequest->title,
            'status'          => $this->postRequest->status,
            'publish_results' => $this->publishResults,
            'publish_errors'  => $this->publishErrors,
            'message'         => $isPartial
                ? "⚠️ Post '{$this->postRequest->title}' was partially published. Check failed platforms to retry."
                : "✅ Post '{$this->postRequest->title}' was published successfully.",
        ];
    }
}
