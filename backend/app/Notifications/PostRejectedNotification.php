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
        return (new MailMessage)
            ->subject("Post Rejected: {$this->postRequest->title}")
            ->greeting("Hello {$notifiable->first_name},")
            ->line("Your post request has been rejected.")
            ->line("**Post:** {$this->postRequest->title}")
            ->line("**Reason:** {$this->reason ?? 'No specific reason provided'}")
            ->action('View Post', url(config('app.frontend_url') . "/requestor/posts/{$this->postRequest->id}"))
            ->line('You may create a new post request addressing the concerns raised.');
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