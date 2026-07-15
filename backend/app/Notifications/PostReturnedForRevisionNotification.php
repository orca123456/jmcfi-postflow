<?php

namespace App\Notifications;

use App\Models\PostRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PostReturnedForRevisionNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public PostRequest $postRequest,
        public ?string $reason = null,
        public ?array $revisionGuidance = null
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $message = (new MailMessage)
            ->subject("Revision Required: {$this->postRequest->title}")
            ->greeting("Hello {$notifiable->first_name},")
            ->line("Your post request requires revision.")
            ->line("**Post:** {$this->postRequest->title}")
            ->line("**Reason:** {$this->reason ?? 'No specific reason provided'}");

        if ($this->revisionGuidance && !empty($this->revisionGuidance)) {
            $message->line('**Revision Guidance:**');
            foreach ($this->revisionGuidance as $category => $suggestions) {
                if (!empty($suggestions)) {
                    $message->line("- **{$category}:** " . implode('; ', $suggestions));
                }
            }
        }

        return $message->action('Revise Post', url(config('app.frontend_url') . "/requestor/posts/{$this->postRequest->id}/edit"))
            ->line('Please revise and resubmit your post.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'post_returned_for_revision',
            'post_request_id' => $this->postRequest->id,
            'post_title' => $this->postRequest->title,
            'reason' => $this->reason,
            'revision_guidance' => $this->revisionGuidance,
            'message' => "Your post '{$this->postRequest->title}' requires revision",
        ];
    }
}