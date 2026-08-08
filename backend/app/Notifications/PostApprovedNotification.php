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
        public ?string $approvedByStage = null,
        public ?string $approverName = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $stageMessages = [
            'office_head'    => "Your Office Head has approved your post request. It has now moved to the Vice-President for the next level of review.",
            'vice_president' => "The Vice-President has approved your post request. It has now been forwarded to the IMC/QA team for their final review.",
            'imc_qa'         => "Congratulations! The IMC/QA team has given the final approval for your post. It is now being published to the target platforms!",
        ];

        $stageSubjects = [
            'office_head'    => '[JMCFI PostFlow] ✅ Office Head Approved — Moving to VP Review',
            'vice_president' => '[JMCFI PostFlow] ✅ VP Approved — Moving to IMC/QA Review',
            'imc_qa'         => '[JMCFI PostFlow] 🎉 Fully Approved & Publishing Now!',
        ];

        $message = $stageMessages[$this->approvedByStage] ?? 'Your post request has been approved and is progressing to the next stage.';
        $subject = $stageSubjects[$this->approvedByStage] ?? '[JMCFI PostFlow] ✅ Post Approved';

        $mail = (new MailMessage)
            ->subject("{$subject}: {$this->postRequest->title}")
            ->greeting("Hello {$notifiable->first_name},")
            ->line($message)
            ->line("**Post Title:** {$this->postRequest->title}");

        if ($this->approverName) {
            $mail->line("**Approved by:** {$this->approverName}");
        }

        $mail->action('View Your Request', url(config('app.frontend_url', 'http://localhost:8081') . "/requestor/posts/{$this->postRequest->id}"))
             ->line('Thank you for your patience. **JMCFI PostFlow System**');

        return $mail;
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type'             => 'post_approved',
            'post_request_id'  => $this->postRequest->id,
            'post_title'       => $this->postRequest->title,
            'approved_by_stage'=> $this->approvedByStage,
            'approver_name'    => $this->approverName,
            'message'          => "Your post '{$this->postRequest->title}' has been approved at stage: {$this->approvedByStage}",
        ];
    }
}