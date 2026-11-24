<?php

namespace App\Notifications;

use App\Models\PostRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class PostPublishedRequestorNotification extends Notification
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

            $rawPlatforms = $this->postRequest->target_platforms ?? ['facebook', 'instagram'];
            if (is_string($rawPlatforms)) {
                $rawPlatforms = json_decode($rawPlatforms, true) ?: [$rawPlatforms];
            }

            $successfulKeys = array_keys($this->publishResults);
            $failedKeys = array_keys($this->publishErrors);

            $successfulFormatted = !empty($successfulKeys)
                ? implode(', ', array_map(fn($p) => ucfirst(strtolower((string)$p)), $successfulKeys))
                : '';

            $categoryName = $this->postRequest->category?->name
                ?? $this->postRequest->other_category_name
                ?? 'Announcement';

            $userName = $notifiable->first_name ?: $notifiable->full_name ?: 'Requestor';
            $isDirectImc = ($this->postRequest->routing_type ?? '') === 'direct_imc';

            $tableDetails = [
                'Title'    => $this->postRequest->title,
                'Category' => $categoryName,
                'Status'   => $isPartial ? 'Partially Published' : 'Published',
            ];

            if ($isDirectImc) {
                $tableDetails['Request Type'] = 'Direct IMC';
            }

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
                $tableDetails['Published Article'] = $wpLink;
            }

            $frontendUrl = env('RAILWAY_PUBLIC_DOMAIN')
                ? 'https://' . rtrim(env('RAILWAY_PUBLIC_DOMAIN'), '/')
                : (config('app.frontend_url') ?: config('app.url') ?: 'https://postflow.jmc.edu.ph');
            $dashboardUrl = rtrim($frontendUrl, '/') . '/dashboard/requestor';

            if ($isPartial) {
                $successSentence = !empty($successfulFormatted)
                    ? "{$successfulFormatted} published successfully."
                    : '';
                $failedSentence = !empty($this->publishErrors)
                    ? collect($this->publishErrors)->map(fn($msg, $plat) => ucfirst($plat) . " publishing failed: {$msg}")->implode(' ')
                    : 'Some target platforms encountered configuration issues.';

                $bodyMessage = trim("{$successSentence} {$failedSentence}");
                $statusBadge = 'PARTIALLY PUBLISHED';
                $statusType = 'warning';
                $subject = "[JMCFI PostFlow] ⚠️ Your Post Has Been Partially Published — {$this->postRequest->title}";
            } else {
                $bodyMessage = $isDirectImc
                    ? 'Your Direct IMC content request has been successfully published to the target institutional platforms by the IMC team.'
                    : 'Your content request has been successfully published to the target institutional platforms.';
                $statusBadge = 'PUBLISHED — SOCIAL MEDIA';
                $statusType = 'published';
                $subject = "[JMCFI PostFlow] ✅ Your Post Has Been Published — {$this->postRequest->title}";
            }

            $viewData = [
                'statusBadge'  => $statusBadge,
                'statusType'   => $statusType,
                'greeting'     => "Hello {$userName},",
                'bodyMessage'  => $bodyMessage,
                'tableDetails' => $tableDetails,
                'actionUrl'    => $dashboardUrl,
                'buttonText'   => 'View My Requests',
                'footerText'   => '© 2026 Jose Maria College Foundation, Inc. All rights reserved.',
            ];

            return (new MailMessage)
                ->subject($subject)
                ->view('emails.custom-template', $viewData);
        } catch (\Throwable $e) {
            Log::error("PostPublishedRequestorNotification::toMail failed for post ID {$this->postRequest->id}: {$e->getMessage()}");
            throw $e;
        }
    }

    public function toArray(object $notifiable): array
    {
        $isPartial = !empty($this->publishErrors) || $this->postRequest->status === PostRequest::STATUS_PARTIALLY_PUBLISHED;

        return [
            'type'                 => $isPartial ? 'post_partially_published' : 'post_published_success',
            'post_request_id'      => $this->postRequest->id,
            'post_title'           => $this->postRequest->title,
            'status'               => $this->postRequest->status,
            'successful_platforms' => array_keys($this->publishResults),
            'failed_platforms'     => array_keys($this->publishErrors),
            'message'              => $isPartial
                ? "⚠️ Post '{$this->postRequest->title}' was partially published. Check details for uncompleted platforms."
                : "✅ Your post '{$this->postRequest->title}' has been published successfully.",
        ];
    }

    public function failed(\Throwable $e): void
    {
        Log::error("PostPublishedRequestorNotification failed for post ID {$this->postRequest->id}: {$e->getMessage()}");
    }
}

