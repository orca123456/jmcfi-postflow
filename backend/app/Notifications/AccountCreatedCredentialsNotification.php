<?php

namespace App\Notifications;

use App\Models\User;
use App\Models\SystemSetting;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AccountCreatedCredentialsNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public User $user,
        public string $plainPassword,
        public ?string $roleName = null
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $tmplHeader = SystemSetting::where('key', 'email_template_header_title')->value('value') ?: 'Jose Maria College Foundation, Inc.';
        $tmplColor  = SystemSetting::where('key', 'email_template_brand_color')->value('value')   ?: '#800000';
        $tmplFooter = SystemSetting::where('key', 'email_template_footer_text')->value('value')  ?: '© ' . date('Y') . ' Jose Maria College Foundation, Inc. All rights reserved.';
        $tmplLogo   = SystemSetting::where('key', 'email_template_logo_url')->value('value')     ?: '';

        $frontendUrl = config('app.frontend_url') ?: 'https://jmcfi-postflow-production.up.railway.app';
        $loginUrl    = rtrim($frontendUrl, '/') . '/login';

        $roleDisplayName = match ($this->roleName ?? $this->user->roles->first()?->name ?? '') {
            'it_admin', 'it_publisher' => 'IT Administrator',
            'office_head' => 'Department / Office Head',
            'vice_president' => 'Vice President',
            'imc_qa_checker' => 'IMC / QA Reviewer',
            'requestor' => 'Staff / Faculty (Requestor)',
            default => 'Institutional Member',
        };

        $viewData = [
            'headerTitle' => $tmplHeader,
            'brandColor'  => $tmplColor,
            'footerText'  => $tmplFooter,
            'logoUrl'     => $tmplLogo,
            'userName'    => $this->user->first_name ?: $this->user->full_name,
            'fullName'    => $this->user->full_name,
            'employeeId'  => $this->user->employee_id,
            'email'       => $this->user->email,
            'password'    => $this->plainPassword,
            'department'  => $this->user->department ?: 'N/A',
            'position'    => $this->user->position ?: $roleDisplayName,
            'roleName'    => $roleDisplayName,
            'loginUrl'    => $loginUrl,
        ];

        return (new MailMessage)
            ->subject("[JMCFI PostFlow] Welcome! Your Institutional Account Credentials")
            ->view('emails.welcome-credentials', $viewData);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type'        => 'account_created',
            'title'       => 'Welcome to JMCFI PostFlow',
            'message'     => 'Your institutional account has been successfully created.',
            'employee_id' => $this->user->employee_id,
            'email'       => $this->user->email,
        ];
    }
}
