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
        return (new MailMessage)
            ->subject("Post Ready for Publishing: {$this->postRequest->title}")
            ->greeting("Hello {$notifiable->first_name},")
            ->line("A post request has completed all approvals and is ready for publishing.")
            ->line("**Post:** {$this->postRequest->title}")
            ->line("**Category:** {$this->postRequest->category?->name}")
            ->line("**Target Platforms:** " . implode(', ', $this->postRequest->target_platforms ?? []))
            ->line("**Preferred Schedule:** " . ($this->postRequest->preferred_schedule_at?->format('M d, Y H:i') ?? 'ASAP'))
            ->action('Publish Post', url(config('app.frontend_url') . "/publisher/posts/{$this->postRequest->id}"))
            ->line('Please schedule or publish this content.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'post_ready_for_publishing',
            'post_request_id' => $this->postRequest->id,
            'post_title' => $this->postRequest->title,
            'target_platforms' => $this->postRequest->target_platforms,
            'preferred_schedule' => $this->postRequest->preferred_schedule_at?->toISOString(),
            'message' => "Post '{$this->postRequest->title}' is ready for publishing",
        ];
    }
}