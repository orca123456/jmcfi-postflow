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
        $platforms = implode(', ', $this->postRequest->target_platforms ?? []);
        $fbPostId  = $this->publishResults['facebook']['id'] ?? null;

        $mail = (new MailMessage)
            ->subject("[JMCFI PostFlow] ✅ Published Successfully: {$this->postRequest->title}")
            ->greeting("Hello {$notifiable->first_name},")
            ->line("The following post has been **successfully published** to the target platforms.")
            ->line("**Post Title:** {$this->postRequest->title}")
            ->line("**Published to:** {$platforms}")
            ->line("**Published at:** " . now()->format('M d, Y H:i'));

        if ($fbPostId && $fbPostId !== 'mock_fb_post_12345') {
            $mail->line("**Facebook Post ID:** {$fbPostId}");
        }

        $mail->action('View in Dashboard', url(config('app.frontend_url', 'http://localhost:8081') . "/admin/posts/{$this->postRequest->id}"))
             ->line('No action is required. This is a confirmation email.')
             ->line('**JMCFI PostFlow System**');

        return $mail;
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
