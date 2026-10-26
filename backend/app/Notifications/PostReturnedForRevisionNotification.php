<?php

namespace App\Notifications;

use App\Models\PostRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PostReturnedForRevisionNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public PostRequest $postRequest,
        public ?string $reason = null,
        public ?array $revisionGuidance = null
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
            'Revision Notes'   => $this->reason ?? 'Please review the requested changes and submit a revised version.',
            'Target Platforms' => $targetPlatformsFormatted,
        ];

        if ($this->revisionGuidance && !empty($this->revisionGuidance)) {
            foreach ($this->revisionGuidance as $category => $suggestions) {
                if (!empty($suggestions)) {
                    $tableDetails["Guidance ({$category})"] = implode('; ', (array)$suggestions);
                }
            }
        }

        $frontendUrl = config('app.frontend_url', 'http://localhost:8081');
        $actionUrl = rtrim($frontendUrl, '/') . "/requestor/posts/{$this->postRequest->id}/edit";

        $viewData = [
            'statusBadge'     => 'ACTION REQUIRED — REVISION',
            'statusType'      => 'revision',
            'greeting'        => $greeting,
            'bodyMessage'     => 'Your post request requires some updates before it can proceed with approval.',
            'tableDetails'    => $tableDetails,
            'actionUrl'       => $actionUrl,
            'buttonText'      => 'Revise Post',
            'footerText'      => '© 2026 Jose Maria College Foundation, Inc. All rights reserved.',
        ];

        return (new MailMessage)
            ->subject("[JMCFI PostFlow] ⚠️ Action Required — Revision: {$this->postRequest->title}")
            ->view('emails.custom-template', $viewData);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type'              => 'post_returned_for_revision',
            'post_request_id'   => $this->postRequest->id,
            'post_title'        => $this->postRequest->title,
            'reason'            => $this->reason,
            'revision_guidance' => $this->revisionGuidance,
            'message'           => "Your post '{$this->postRequest->title}' requires revision",
        ];
    }
}