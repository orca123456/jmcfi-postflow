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
        $platforms = implode(', ', $this->postRequest->target_platforms ?? []);
        $schedule  = $this->postRequest->preferred_schedule_at?->format('M d, Y H:i') ?? 'ASAP';

        return (new MailMessage)
            ->subject("[JMCFI PostFlow] 📢 Post Fully Approved & Ready to Publish: {$this->postRequest->title}")
            ->greeting("Hello {$notifiable->first_name},")
            ->line("A post request has passed **all approval stages** and is now ready to be published.")
            ->line("**Post Title:** {$this->postRequest->title}")
            ->line("**Category:** {$this->postRequest->category?->name}")
            ->line("**Target Platforms:** {$platforms}")
            ->line("**Preferred Schedule:** {$schedule}")
            ->line("**Requested by:** {$this->postRequest->requestor?->full_name}")
            ->action('View & Publish Post', url(config('app.frontend_url', 'http://localhost:8081') . "/admin/posts/{$this->postRequest->id}"))
            ->line('The system will attempt to auto-publish this post. You may also publish it manually from the dashboard.')
            ->line('Thank you, **JMCFI PostFlow System**');
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