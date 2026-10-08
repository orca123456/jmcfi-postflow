<?php

namespace App\Notifications;

use App\Models\PostRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PostReadyForPublishingNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public PostRequest $postRequest) {}

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
        $schedule  = $this->postRequest->preferred_schedule_at?->format('M d, Y H:i') ?? 'ASAP';
        $frontendUrl = config('app.frontend_url') ?: 'https://jmcfi-postflow-production.up.railway.app';
        $actionUrl = rtrim($frontendUrl, '/') . "/dashboard/it-admin";

        $extraDetails = [
            'Category' => $this->postRequest->category?->name ?? 'General',
            'Target Platforms' => $platforms ?: 'All',
            'Preferred Schedule' => $schedule,
            'Requested By' => $this->postRequest->requestor?->full_name ?? 'Staff',
        ];

        $viewData = [
            'headerTitle'   => $tmplHeader,
            'brandColor'    => $tmplColor,
            'footerText'    => $tmplFooter,
            'logoUrl'       => $tmplLogo,
            'userName'      => $notifiable->first_name ?? $notifiable->full_name ?? 'Publisher',
            'statusType'    => 'ready',
            'statusLabel'   => 'Ready to Publish',
            'bodyMessage'   => 'A post request has successfully passed all approval stages and is ready to be published.',
            'postTitle'     => $this->postRequest->title,
            'extraDetails'  => $extraDetails,
            'actionUrl'     => $actionUrl,
            'buttonText'    => 'View & Publish Post',
        ];

        return (new MailMessage)
            ->subject("[JMCFI PostFlow] 📢 Ready to Publish: {$this->postRequest->title}")
            ->view('emails.custom-template', $viewData);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type'              => 'post_ready_for_publishing',
            'post_request_id'   => $this->postRequest->id,
            'post_title'        => $this->postRequest->title,
            'target_platforms'  => $this->postRequest->target_platforms,
            'preferred_schedule'=> $this->postRequest->preferred_schedule_at?->toISOString(),
            'message'           => "Post '{$this->postRequest->title}' is fully approved and ready for publishing",
        ];
    }
}