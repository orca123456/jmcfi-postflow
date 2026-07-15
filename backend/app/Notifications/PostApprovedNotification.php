<?php

namespace App\Notifications;

use App\Models\PostRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PostApprovedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public PostRequest $postRequest,
        public ?string $approverName = null
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Post Approved: {$this->postRequest->title}")
            ->greeting("Hello {$notifiable->first_name},")
            ->line("Your post request has been approved!")
            ->line("**Post:** {$this->postRequest->title}")
            ->line("**Approved by:** {$this->approverName ?? 'Approver'}")
            ->action('View Post', url(config('app.frontend_url') . "/requestor/posts/{$this->postRequest->id}"))
            ->line('Your post is now moving to the next approval stage or ready for publishing.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'post_approved',
            'post_request_id' => $this->postRequest->id,
            'post_title' => $this->postRequest->title,
            'approver_name' => $this->approverName,
            'message' => "Your post '{$this->postRequest->title}' has been approved",
        ];
    }
}