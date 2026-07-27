<?php

namespace App\Notifications;

use App\Models\PostRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ApprovalNeededNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public PostRequest $postRequest) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $stage = $this->postRequest->currentApprovalStage()?->stage;
        $stageLabels = [
            'office_head' => 'Office Head Review',
            'vice_president' => 'Vice President Review',
            'imc_qa' => 'IMC/QA Review',
        ];

        $stageLabel = $stageLabels[$stage] ?? 'review';

        return (new MailMessage)
            ->subject("Approval Needed: {$this->postRequest->title}")
            ->greeting("Hello {$notifiable->first_name},")
            ->line("A post request requires your {$stageLabel}.")
            ->line("**Post:** {$this->postRequest->title}")
            ->line("**Category:** {$this->postRequest->category?->name}")
            ->line("**Requested by:** {$this->postRequest->requestor->full_name}")
            ->action('Review Post', url(config('app.frontend_url') . "/approver/posts/{$this->postRequest->id}"))
            ->line('Please review and take action at your earliest convenience.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'approval_needed',
            'post_request_id' => $this->postRequest->id,
            'post_title' => $this->postRequest->title,
            'stage' => $this->postRequest->currentApprovalStage()?->stage,
            'message' => "Approval needed for '{$this->postRequest->title}'",
        ];
    }
}