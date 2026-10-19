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
        $appUrl     = rtrim(config('app.url') ?: 'https://postflow.jmc.edu.ph', '/');
        $tmplHeader = SystemSetting::where('key', 'email_template_header_title')->value('value') ?: 'Jose Maria College Foundation, Inc.';
        $tmplColor  = SystemSetting::where('key', 'email_template_brand_color')->value('value')   ?: '#4C1D95';
        $tmplFooter = SystemSetting::where('key', 'email_template_footer_text')->value('value')  ?: 'Jose Maria College Foundation, Inc.';
        $tmplLogo   = SystemSetting::where('key', 'email_template_logo_url')->value('value')     ?: "{$appUrl}/images/jmc_logo.png";
        $headerBg   = "{$appUrl}/images/jmcbg2.jpeg";

        $frontendUrl = config('app.frontend_url') ?: 'https://postflow.jmc.edu.ph';
        $loginUrl    = rtrim($frontendUrl, '/') . '/login';

        // Resolve clean Designation: Requestor or Approver (never 'Staff / Faculty')
        $rawRole = strtolower(trim($this->roleName ?? $this->user->roles->first()?->name ?? 'requestor'));
        $rawPos  = trim((string)($this->user->position ?? ''));

        if (in_array($rawRole, ['requestor', 'content_requestor'], true)) {
            $designation = 'Requestor';
        } elseif (in_array($rawRole, ['approver', 'office_head', 'vice_president', 'imc_qa_checker'], true)) {
            $designation = 'Approver';
        } elseif (in_array($rawRole, ['it_admin', 'it_publisher', 'admin'], true)) {
            $designation = 'IT Administrator';
        } elseif (!empty($rawPos) && !str_contains(strtolower($rawPos), 'staff') && !str_contains(strtolower($rawPos), 'faculty')) {
            $designation = $rawPos;
        } else {
            $designation = 'Requestor';
        }

        $viewData = [
            'headerTitle' => $tmplHeader,
            'headerBg'    => $headerBg,
            'brandColor'  => $tmplColor,
            'footerText'  => $tmplFooter,
            'logoUrl'     => $tmplLogo,
            'userName'    => $this->user->first_name ?: $this->user->full_name,
            'fullName'    => $this->user->full_name,
            'employeeId'  => $this->user->employee_id,
            'email'       => $this->user->email,
            'password'    => $this->plainPassword,
            'department'  => $this->user->department ?: 'N/A',
            'designation' => $designation,
            'position'    => $designation,
            'roleName'    => $designation,
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
