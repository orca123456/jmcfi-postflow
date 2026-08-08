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

    public function __construct(
        public PostRequest $postRequest,
        public ?string $forStage = null
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $stage = $this->forStage ?? $this->postRequest->currentApprovalStage()?->stage;

        $stageLabels = [
            'office_head'     => 'Office Head Review',
            'vice_president'  => 'Vice President Review',
            'imc_qa'          => 'IMC / QA Final Review',
        ];

        $stageMessages = [
            'office_head'    => 'A new post request from your department has been submitted and requires your initial approval.',
            'vice_president' => 'A post request has passed the Office Head review and now needs your Vice-President approval.',
            'imc_qa'         => 'A post request has been approved by the VP and is now awaiting your final IMC/QA sign-off before publishing.',
        ];

        $stageLabel   = $stageLabels[$stage]   ?? 'Review';
        $stageMessage = $stageMessages[$stage] ?? 'A post request requires your action.';

        return (new MailMessage)
            ->subject("[JMCFI PostFlow] Action Required — {$stageLabel}: {$this->postRequest->title}")
            ->greeting("Hello {$notifiable->first_name},")
            ->line($stageMessage)
            ->line("**Post Title:** {$this->postRequest->title}")
            ->line("**Category:** {$this->postRequest->category?->name}")
            ->line("**Submitted by:** {$this->postRequest->requestor?->full_name}")
            ->line("**Department:** {$this->postRequest->requestor?->department}")
            ->action('Review & Take Action', url(config('app.frontend_url', 'http://localhost:8081') . "/approver/posts/{$this->postRequest->id}"))
            ->line('Please review the post and take action at your earliest convenience.')
            ->line('Thank you, **JMCFI PostFlow System**');
    }

    public function toArray(object $notifiable): array
    {
        $stage = $this->forStage ?? $this->postRequest->currentApprovalStage()?->stage;
        return [
            'type'            => 'approval_needed',
            'post_request_id' => $this->postRequest->id,
            'post_title'      => $this->postRequest->title,
            'stage'           => $stage,
            'message'         => "Approval needed for '{$this->postRequest->title}'",
        ];
    }
}