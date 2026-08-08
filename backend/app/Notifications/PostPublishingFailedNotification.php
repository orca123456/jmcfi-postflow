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
        $platforms = implode(', ', $this->postRequest->target_platforms ?? []);

        return (new MailMessage)
            ->subject("[JMCFI PostFlow] 🚨 URGENT: Failed to Publish — {$this->postRequest->title}")
            ->greeting("Hello {$notifiable->first_name},")
            ->line("⚠️ The system **failed to automatically publish** the following post. Manual intervention is required.")
            ->line("**Post Title:** {$this->postRequest->title}")
            ->line("**Target Platforms:** {$platforms}")
            ->line("**Error Reason:** {$this->errorMessage}")
            ->line("**Failed at:** " . now()->format('M d, Y H:i'))
            ->action('Publish Manually', url(config('app.frontend_url', 'http://localhost:8081') . "/admin/posts/{$this->postRequest->id}"))
            ->line('Please log in to the dashboard and use the **Force Publish Manually** button to resolve this.')
            ->line('**JMCFI PostFlow System**');
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
