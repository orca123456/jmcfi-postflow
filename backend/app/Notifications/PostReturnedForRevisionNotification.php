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
        $tmplHeader = \App\Models\SystemSetting::where('key', 'email_template_header_title')->value('value') ?: 'Jose Maria College Foundation, Inc.';
        $tmplColor  = \App\Models\SystemSetting::where('key', 'email_template_brand_color')->value('value')   ?: '#800000';
        $tmplFooter = \App\Models\SystemSetting::where('key', 'email_template_footer_text')->value('value')  ?: '© ' . date('Y') . ' Jose Maria College Foundation, Inc. All rights reserved.';
        $tmplLogo   = \App\Models\SystemSetting::where('key', 'email_template_logo_url')->value('value')     ?: '';

        $frontendUrl = config('app.frontend_url') ?: 'https://jmcfi-postflow-production.up.railway.app';
        $actionUrl = rtrim($frontendUrl, '/') . "/requestor/posts/{$this->postRequest->id}/edit";

        $extraDetails = [];
        if ($this->revisionGuidance && !empty($this->revisionGuidance)) {
            foreach ($this->revisionGuidance as $category => $suggestions) {
                if (!empty($suggestions)) {
                    $extraDetails["Guidance ({$category})"] = implode('; ', $suggestions);
                }
            }
        }

        $viewData = [
            'headerTitle'   => $tmplHeader,
            'brandColor'    => $tmplColor,
            'footerText'    => $tmplFooter,
            'logoUrl'       => $tmplLogo,
            'userName'      => $notifiable->first_name ?? $notifiable->full_name ?? 'Requestor',
            'statusType'    => 'revision',
            'statusLabel'   => 'Revision Required',
            'bodyMessage'   => 'Your post request requires some updates before it can proceed with approval.',
            'postTitle'     => $this->postRequest->title,
            'reason'        => $this->reason ?? 'Please review the requested changes and submit a revised version.',
            'extraDetails'  => $extraDetails,
            'actionUrl'     => $actionUrl,
            'buttonText'    => 'Revise Post',
        ];

        return (new MailMessage)
            ->subject("[JMCFI PostFlow] ⚠️ Revision Required: {$this->postRequest->title}")
            ->view('emails.custom-template', $viewData);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'post_returned_for_revision',
            'post_request_id' => $this->postRequest->id,
            'post_title' => $this->postRequest->title,
            'reason' => $this->reason,
            'revision_guidance' => $this->revisionGuidance,
            'message' => "Your post '{$this->postRequest->title}' requires revision",
        ];
    }
}