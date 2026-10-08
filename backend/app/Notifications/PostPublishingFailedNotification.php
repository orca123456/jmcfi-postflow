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
        $tmplHeader = \App\Models\SystemSetting::where('key', 'email_template_header_title')->value('value') ?: 'JMCFI PostFlow Notification';
        $tmplColor  = \App\Models\SystemSetting::where('key', 'email_template_brand_color')->value('value')   ?: '#800000';
        $tmplFooter = \App\Models\SystemSetting::where('key', 'email_template_footer_text')->value('value')  ?: '© ' . date('Y') . ' Jose Maria College Foundation, Inc. All rights reserved.';
        $tmplLogo   = \App\Models\SystemSetting::where('key', 'email_template_logo_url')->value('value')     ?: '';

        $platforms = implode(', ', $this->postRequest->target_platforms ?? []);

        $viewData = [
            'headerTitle'     => $tmplHeader,
            'brandColor'      => $tmplColor,
            'footerText'      => $tmplFooter,
            'logoUrl'         => $tmplLogo,
            'userName'        => $notifiable->first_name ?? $notifiable->full_name ?? 'Administrator',
            'statusType'      => 'failed',
            'statusLabel'     => '🚨 Publish Failed',
            'bodyMessage'     => 'The system failed to automatically broadcast this post. Manual intervention is required.',
            'postTitle'       => $this->postRequest->title,
            'reason'          => null,
            'errorMessage'    => $this->errorMessage,
            'failedAt'        => now()->format('M d, Y H:i'),
            'targetPlatforms' => $platforms,
            'actionUrl'       => url(config('app.frontend_url', env('APP_FRONTEND_URL', 'http://localhost:3000')) . "/dashboard/it-admin"),
            'buttonText'      => 'Open Dashboard & Publish Manually',
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
