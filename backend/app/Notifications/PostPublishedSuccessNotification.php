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
        $tmplHeader = \App\Models\SystemSetting::where('key', 'email_template_header_title')->value('value') ?: 'Jose Maria College Foundation, Inc.';
        $tmplColor  = \App\Models\SystemSetting::where('key', 'email_template_brand_color')->value('value')   ?: '#800000';
        $tmplFooter = \App\Models\SystemSetting::where('key', 'email_template_footer_text')->value('value')  ?: '© ' . date('Y') . ' Jose Maria College Foundation, Inc. All rights reserved.';
        $tmplLogo   = \App\Models\SystemSetting::where('key', 'email_template_logo_url')->value('value')     ?: '';

        $platforms = implode(', ', $this->postRequest->target_platforms ?? []);
        $fbPostId  = $this->publishResults['facebook']['id'] ?? null;
        $wpLink    = $this->publishResults['wordpress']['link'] ?? null;

        $extraDetails = [];
        if ($fbPostId && $fbPostId !== 'mock_fb_post_12345') {
            $extraDetails['Facebook Post ID'] = $fbPostId;
        }
        if (!empty($wpLink)) {
            $extraDetails['WordPress Article'] = $wpLink;
        }

        $frontendUrl = config('app.frontend_url') ?: 'https://jmcfi-postflow-production.up.railway.app';
        $dashboardUrl = rtrim($frontendUrl, '/') . "/dashboard/it-admin";

        $viewData = [
            'headerTitle'        => $tmplHeader,
            'brandColor'         => $tmplColor,
            'footerText'         => $tmplFooter,
            'logoUrl'            => $tmplLogo,
            'userName'           => $notifiable->first_name ?? $notifiable->full_name ?? 'System Administrator',
            'statusType'         => 'published',
            'statusLabel'        => 'Published Successfully',
            'bodyMessage'        => 'The following post has been successfully published to the target social platforms.',
            'postTitle'          => $this->postRequest->title,
            'publishedPlatforms' => $platforms ?: 'facebook, instagram',
            'publishedAt'        => now()->format('M d, Y H:i'),
            'extraDetails'       => $extraDetails,
            'actionUrl'          => $dashboardUrl,
            'buttonText'         => 'View in Dashboard',
        ];

        return (new MailMessage)
            ->subject("[JMCFI PostFlow] ✅ Published Successfully: {$this->postRequest->title}")
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
