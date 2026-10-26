<?php

namespace App\Notifications;

use App\Models\Department;
use App\Models\PostRequest;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ApprovalReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public PostRequest $postRequest,
        public ?string $forStage = null,
        public ?string $approverName = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $stage = $this->forStage ?? $this->postRequest->currentApprovalStage()?->stage ?? 'office_head';

        // Approver name resolution
        $approverFirstName = $notifiable->first_name ?: ($this->approverName ? explode(' ', trim($this->approverName))[0] : null);
        $approverFullName = $this->approverName ?: ($notifiable->full_name ?: trim(($notifiable->first_name ?? '') . ' ' . ($notifiable->last_name ?? '')));

        // Resolve Category
        $categoryName = $this->postRequest->category?->name
            ?? $this->postRequest->other_category_name
            ?? 'Announcement';

        // Resolve Target Platforms formatted
        $rawPlatforms = $this->postRequest->target_platforms ?? ['facebook', 'instagram'];
        if (is_string($rawPlatforms)) {
            $rawPlatforms = json_decode($rawPlatforms, true) ?: [$rawPlatforms];
        }
        $targetPlatformsFormatted = !empty($rawPlatforms)
            ? implode(', ', array_map(fn($p) => ucfirst(strtolower((string)$p)), (array)$rawPlatforms))
            : 'Facebook, Instagram';

        // Resolve Requestor and Department
        $requestor = $this->postRequest->requestor;
        $requestorName = $requestor?->full_name
            ?: trim(($requestor?->first_name ?? '') . ' ' . ($requestor?->last_name ?? ''))
            ?: 'April Joy Domopoy';
        $deptRaw = $requestor?->department ?: 'BSA';
        $deptCode = $deptRaw ?: 'BSA';

        $deptFullName = $this->postRequest->department;

        if ($deptRaw && !$deptFullName) {
            $deptModel = Department::where('name', $deptRaw)->orWhere('display_name', $deptRaw)->first();
            if ($deptModel) {
                $deptCode = $deptModel->name;
                $deptFullName = $deptModel->description ?: ($deptModel->display_name ?: $deptModel->name);
            } else {
                $deptFullName = match(strtoupper($deptRaw)) {
                    'BSA'                  => 'Bachelor of Science in Accountancy',
                    'CITE', 'BSIT', 'BSCS' => 'College of Information Technology Education',
                    'CTE'                  => 'College of Teacher Education',
                    'CAS'                  => 'College of Arts and Sciences',
                    'CCJ'                  => 'College of Criminal Justice',
                    default                => $deptRaw,
                };
            }
        }

        if (!$deptFullName || $deptFullName === 'BSA') {
            $deptFullName = 'College of Information Technology Education';
        }

        // Resolve Requested On with (PHT)
        $requestedOnDate = $this->postRequest->created_at ?: now();
        $requestedOn = Carbon::parse($requestedOnDate)->setTimezone('Asia/Manila')->format('F j, Y \a\t g:i A') . ' (PHT)';

        switch ($stage) {
            case 'office_head':
                $nameForGreeting = $approverFirstName ?: 'Ferry';
                $greeting = "Hello Department Head {$nameForGreeting},";
                $bodyMessage = "This is a friendly reminder that a post request from your department is still awaiting your review. Please review and take action in PostFlow.";
                $subject = "[JMCFI PostFlow] Reminder: Action Required — Department Head Review: {$this->postRequest->title}";
                $tableDetails = [
                    'Title'            => $this->postRequest->title,
                    'Category'         => $categoryName,
                    'Submitted by'     => "{$requestorName} ({$deptCode})",
                    'Target Platforms' => $targetPlatformsFormatted,
                    'Requested on'     => $requestedOn,
                ];
                break;

            case 'vice_president':
                $greeting = "Hello Vice President,";
                $bodyMessage = "This is a friendly reminder that a post request is awaiting your approval. Please review and take action in PostFlow.";
                $subject = "[JMCFI PostFlow] Reminder: Action Required — Vice President Approval: {$this->postRequest->title}";
                $tableDetails = [
                    'Title'            => $this->postRequest->title,
                    'Category'         => $categoryName,
                    'Submitted by'     => "{$requestorName} ({$deptCode})",
                    'Department'       => $deptFullName,
                    'Target Platforms' => $targetPlatformsFormatted,
                    'Requested on'     => $requestedOn,
                ];
                break;

            case 'imc_qa':
            default:
                $nameForGreeting = $approverFullName ?: 'Angela Cruz';
                $greeting = "Hello IMC {$nameForGreeting},";
                $bodyMessage = "This is a friendly reminder that a post request is awaiting your final approval. Please review and take action in PostFlow.";
                $subject = "[JMCFI PostFlow] Reminder: Action Required — IMC Final Approval: {$this->postRequest->title}";
                $tableDetails = [
                    'Title'            => $this->postRequest->title,
                    'Category'         => $categoryName,
                    'Submitted by'     => "{$requestorName} ({$deptCode})",
                    'Department'       => $deptFullName,
                    'Target Platforms' => $targetPlatformsFormatted,
                    'Requested on'     => $requestedOn,
                ];
                break;
        }

        $frontendUrl = config('app.frontend_url', 'http://localhost:8081');
        $postId = $this->postRequest->id ?: 1;
        $actionUrl = rtrim($frontendUrl, '/') . "/approver/posts/{$postId}";

        $viewData = [
            'statusBadge'     => 'REMINDER — ACTION REQUIRED',
            'statusType'      => 'reminder',
            'badgeBgColor'    => '#ede9fe',
            'badgeTextColor'  => '#4338ca',
            'greeting'        => $greeting,
            'bodyMessage'     => $bodyMessage,
            'tableDetails'    => $tableDetails,
            'actionUrl'       => $actionUrl,
            'buttonText'      => 'Review & Take Action',
            'buttonColor'     => '#2e0854',
            'footerText'      => '© 2026 Jose Maria College Foundation, Inc. All rights reserved.',
        ];

        return (new MailMessage)
            ->subject($subject)
            ->view('emails.custom-template', $viewData);
    }

    public function toArray(object $notifiable): array
    {
        $stage = $this->forStage ?? $this->postRequest->currentApprovalStage()?->stage ?? 'office_head';
        $label = match($stage) {
            'office_head'    => 'Department Head',
            'vice_president' => 'Vice President',
            'imc_qa'         => 'IMC / QA',
            default          => 'Approval',
        };
        return [
            'type'            => 'approval_reminder',
            'post_request_id' => $this->postRequest->id,
            'post_title'      => $this->postRequest->title,
            'stage'           => $stage,
            'message'         => "Reminder: {$label} review is still pending for '{$this->postRequest->title}'",
        ];
    }
}
