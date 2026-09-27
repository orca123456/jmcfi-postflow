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
        $tmplHeader = \App\Models\SystemSetting::where('key', 'email_template_header_title')->value('value') ?: 'JMCFI PostFlow Notification';
        $tmplColor  = \App\Models\SystemSetting::where('key', 'email_template_brand_color')->value('value')   ?: '#800000';
        $tmplFooter = \App\Models\SystemSetting::where('key', 'email_template_footer_text')->value('value')  ?: '© ' . date('Y') . ' Jose Maria College Foundation, Inc. All rights reserved.';
        $tmplLogo   = \App\Models\SystemSetting::where('key', 'email_template_logo_url')->value('value')     ?: '';

        $viewData = [
            'headerTitle' => $tmplHeader,
            'brandColor' => $tmplColor,
            'footerText' => $tmplFooter,
            'logoUrl' => $tmplLogo,
            'userName' => $notifiable->first_name ?? $notifiable->full_name ?? 'User',
            'statusType' => 'rejected',
            'statusLabel' => 'Post Request Rejected',
            'bodyMessage' => 'Your post request has been reviewed and rejected by the approval authority.',
            'postTitle' => $this->postRequest->title,
            'reason' => $this->reason ?? 'No specific reason provided.',
            'targetPlatforms' => $this->postRequest->target_platforms ?? [],
            'actionUrl' => url(config('app.frontend_url') . "/requestor/posts/{$this->postRequest->id}"),
            'buttonText' => 'View Post Request'
        ];

        return (new MailMessage)
            ->subject("Post Rejected: {$this->postRequest->title}")
            ->view('emails.custom-template', $viewData);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'post_rejected',
            'post_request_id' => $this->postRequest->id,
            'post_title' => $this->postRequest->title,
            'reason' => $this->reason,
            'message' => "Your post '{$this->postRequest->title}' has been rejected",
        ];
    }
}