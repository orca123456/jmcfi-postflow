<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use App\Services\AuditLogService;

class EmailSettingController extends Controller
{
    private array $allowedKeys = [
        'mail_mailer',
        'mail_host',
        'mail_port',
        'mail_username',
        'mail_from_address',
        'mail_from_name',
        'mail_encryption',
        'email_template_header_title',
        'email_template_header_subtitle',
        'email_template_brand_color',
        'email_template_status_badge',
        'email_template_greeting',
        'email_template_body_message',
        'email_template_button_text',
        'email_template_footer_text',
        'email_template_logo_url',
        'email_template_banner_url',
        'email_template_banner_mode',
        'email_template_content_image_url',
        'email_template_details_json',
    ];

    /**
     * Get current email settings (never expose the password).
     */
    public function getSettings(): JsonResponse
    {
        if (request()->user()?->roleCategory() !== 'admin') {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $settings = [];
        foreach ($this->allowedKeys as $key) {
            $settings[$key] = SystemSetting::where('key', $key)->value('value') ?? '';
        }

        // Indicate password is set without revealing it
        $settings['mail_password_set'] = !empty(SystemSetting::where('key', 'mail_password')->value('value'));

        return response()->json(['settings' => $settings]);
    }

    /**
     * Update email settings.
     */
    public function updateSettings(Request $request): JsonResponse
    {
        if ($request->user()?->roleCategory() !== 'admin') {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'mail_mailer'                 => 'required|string|in:smtp,log,sendmail',
            'mail_host'                   => 'nullable|string|max:255',
            'mail_port'                   => 'nullable|string|max:10',
            'mail_username'               => 'nullable|string|max:255',
            'mail_password'               => 'nullable|string|max:255',
            'mail_encryption'             => 'nullable|string|in:tls,ssl,',
            'mail_from_address'           => 'nullable|email|max:255',
            'mail_from_name'              => 'nullable|string|max:255',
            'email_template_header_title'    => 'nullable|string|max:255',
            'email_template_header_subtitle' => 'nullable|string|max:255',
            'email_template_brand_color'     => 'nullable|string|max:50',
            'email_template_status_badge'    => 'nullable|string|max:255',
            'email_template_greeting'        => 'nullable|string|max:255',
            'email_template_body_message'    => 'nullable|string|max:2000',
            'email_template_button_text'     => 'nullable|string|max:255',
            'email_template_footer_text'        => 'nullable|string|max:1000',
            'email_template_logo_url'           => 'nullable|string|max:2000',
            'email_template_banner_url'         => 'nullable|string|max:2000',
            'email_template_banner_mode'        => 'nullable|string|in:overlay,full_image',
            'email_template_content_image_url'  => 'nullable|string|max:2000',
            'email_template_details_json'       => 'nullable|string|max:10000',
        ]);

        foreach ($this->allowedKeys as $key) {
            if (array_key_exists($key, $validated)) {
                SystemSetting::updateOrCreate(
                    ['key' => $key],
                    ['value' => (string)($validated[$key] ?? ''), 'type' => 'string', 'description' => "Mail setting: {$key}", 'is_public' => false]
                );
            }
        }

        // Save password separately only if provided
        if (!empty($validated['mail_password'])) {
            SystemSetting::updateOrCreate(
                ['key' => 'mail_password'],
                ['value' => $validated['mail_password'], 'type' => 'string', 'description' => 'Mail SMTP Password (encrypted)', 'is_public' => false]
            );
        }

        return response()->json(['message' => 'Email settings saved successfully.']);
    }

    /**
     * Send a test email to the currently logged-in admin.
     * Accepts test parameters directly from the request or falls back to database settings.
     */
    public function sendTestEmail(Request $request): JsonResponse
    {
        if ($request->user()?->roleCategory() !== 'admin') {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $reqUser = trim((string)$request->input('mail_username'));
        $reqFrom = trim((string)$request->input('mail_from_address'));
        $reqPass = trim((string)$request->input('mail_password'));

        $username = !empty($reqUser) ? $reqUser : (!empty($reqFrom) ? $reqFrom : (SystemSetting::where('key', 'mail_username')->value('value') ?: SystemSetting::where('key', 'mail_from_address')->value('value') ?: ''));
        $password = !empty($reqPass) ? $reqPass : (SystemSetting::where('key', 'mail_password')->value('value') ?: '');

        $host     = !empty($request->input('mail_host'))       ? $request->input('mail_host')       : (SystemSetting::where('key', 'mail_host')->value('value')     ?: 'smtp.gmail.com');
        $port     = !empty($request->input('mail_port'))       ? $request->input('mail_port')       : (SystemSetting::where('key', 'mail_port')->value('value')     ?: '587');
        $encrypt  = !empty($request->input('mail_encryption')) ? $request->input('mail_encryption') : (SystemSetting::where('key', 'mail_encryption')->value('value') ?: 'tls');
        $fromName = !empty($request->input('mail_from_name'))  ? $request->input('mail_from_name')  : (SystemSetting::where('key', 'mail_from_name')->value('value')    ?: 'JMCFI PostFlow');
        $fromAddr = !empty($reqFrom) ? $reqFrom : $username;
        $mailer   = !empty($request->input('mail_mailer'))     ? $request->input('mail_mailer')     : (SystemSetting::where('key', 'mail_mailer')->value('value')    ?: 'smtp');

        if ($mailer === 'smtp' && (empty($username) || empty($password))) {
            return response()->json([
                'message' => 'Please enter your Email Address and 16-character Gmail App Password before testing.'
            ], 422);
        }

        // Temporarily override mail config with test settings
        $this->applyMailConfigCustom($mailer, $host, $port, $username, $password, $encrypt, $fromAddr, $fromName);

        $adminEmail = $request->user()->email;
        $adminName  = $request->user()->full_name;
        $cleanPassword = str_replace(' ', '', $password);

        $tmplHeader   = $request->input('email_template_header_title')    ?: (SystemSetting::where('key', 'email_template_header_title')->value('value')    ?: 'Jose Maria College Foundation, Inc.');
        $tmplSubtitle = $request->input('email_template_header_subtitle') ?: (SystemSetting::where('key', 'email_template_header_subtitle')->value('value') ?: 'Assured • Consistent • Quality Education');
        $tmplColor    = $request->input('email_template_brand_color')     ?: (SystemSetting::where('key', 'email_template_brand_color')->value('value')     ?: '#2E0854');
        $tmplBadge    = $request->input('email_template_status_badge')    ?: (SystemSetting::where('key', 'email_template_status_badge')->value('value')    ?: 'PUBLISHED — SOCIAL MEDIA');
        $tmplGreeting = $request->input('email_template_greeting')        ?: (SystemSetting::where('key', 'email_template_greeting')->value('value')        ?: "Hello {$adminName},");
        $tmplBody     = $request->input('email_template_body_message')    ?: (SystemSetting::where('key', 'email_template_body_message')->value('value')    ?: 'The following post has been successfully published to the target institutional platforms.');
        $tmplButton   = $request->input('email_template_button_text')     ?: (SystemSetting::where('key', 'email_template_button_text')->value('value')     ?: 'View in Dashboard');
        $tmplFooter   = $request->input('email_template_footer_text')     ?: (SystemSetting::where('key', 'email_template_footer_text')->value('value')     ?: '© ' . date('Y') . ' Jose Maria College Foundation, Inc. All rights reserved.');
        $tmplLogo     = $request->input('email_template_logo_url')        ?: (SystemSetting::where('key', 'email_template_logo_url')->value('value')        ?: '');
        $tmplBanner   = $request->input('email_template_banner_url')      ?: (SystemSetting::where('key', 'email_template_banner_url')->value('value')      ?: '');
        $tmplBannerMode = $request->input('email_template_banner_mode')   ?: (SystemSetting::where('key', 'email_template_banner_mode')->value('value')     ?: 'overlay');
        $tmplContentImg = $request->input('email_template_content_image_url') ?: (SystemSetting::where('key', 'email_template_content_image_url')->value('value') ?: '');
        $tmplDetailsRaw = $request->input('email_template_details_json')  ?: (SystemSetting::where('key', 'email_template_details_json')->value('value')  ?: '');

        $tableDetails = [];
        if (!empty($tmplDetailsRaw)) {
            $decodedRows = is_string($tmplDetailsRaw) ? json_decode($tmplDetailsRaw, true) : $tmplDetailsRaw;
            if (is_array($decodedRows)) {
                foreach ($decodedRows as $row) {
                    $label = trim((string)($row['label'] ?? ''));
                    $val   = trim((string)($row['value'] ?? ''));
                    if ($label !== '') {
                        if (preg_match('/^(.)\1{3,}$/', $val) || str_contains($val, 'AAAAAA')) {
                            $val = 'Annual Student Orientation 2026';
                        }
                        $tableDetails[$label] = $val;
                    }
                }
            }
        }
        if (empty($tableDetails)) {
            $tableDetails = [
                'Title'               => 'Annual Student Orientation 2026',
                'Category'            => 'Announcement',
                'Published Platforms' => 'Facebook, Instagram',
                'Published At'        => now()->format('M d, Y h:i A'),
                'Facebook Post ID'    => '122125475451447703',
            ];
        }

        $viewData = [
            'headerTitle'       => $tmplHeader,
            'headerSubtitle'    => $tmplSubtitle,
            'brandColor'        => $tmplColor,
            'buttonColor'       => $tmplColor,
            'footerText'        => $tmplFooter,
            'headerBannerUrl'   => $tmplLogo ?: null,
            'headerBannerBgUrl' => $tmplBanner ?: null,
            'bannerMode'        => $tmplBannerMode,
            'contentImageUrl'   => $tmplContentImg ?: null,
            'userName'          => $adminName,
            'greeting'          => $tmplGreeting,
            'statusBadge'       => $tmplBadge,
            'statusType'        => 'published',
            'bodyMessage'       => $tmplBody,
            'tableDetails'      => $tableDetails,
            'actionUrl'             => url(config('app.frontend_url') ?? 'https://jmcfi-postflow-production.up.railway.app'),
            'buttonText'            => $tmplButton,
            'isTemplatePreviewTest' => true,
        ];

        $htmlContent = view('emails.custom-template', $viewData)->render();

        $isSendGrid = str_contains(strtolower($host), 'sendgrid') || str_starts_with($cleanPassword, 'SG.');
        $isResend   = str_contains(strtolower($host), 'resend')   || str_starts_with($cleanPassword, 're_');

        if ($isSendGrid) {
            try {
                $client = new \GuzzleHttp\Client();
                $res = $client->post('https://api.sendgrid.com/v3/mail/send', [
                    'headers' => [
                        'Authorization' => 'Bearer ' . $cleanPassword,
                        'Content-Type'  => 'application/json',
                    ],
                    'json' => [
                        'personalizations' => [
                            [
                                'to' => [
                                    ['email' => $adminEmail, 'name' => $adminName]
                                ]
                            ]
                        ],
                        'from' => [
                            'email' => $fromAddr ?: 'postflow@jmc.edu.ph',
                            'name'  => $fromName ?: 'JMCFI PostFlow'
                        ],
                        'subject' => "[{$fromName}] Notification: System Publishing Setup Verified",
                        'content' => [
                            [
                                'type'  => 'text/plain',
                                'value' => "Hello {$adminName},\n\nThis is an official notification confirming that the JMCFI PostFlow publishing integration is active and operating normally.\n\nSincerely,\nJMCFI PostFlow System"
                            ],
                            [
                                'type'  => 'text/html',
                                'value' => $htmlContent
                            ]
                        ]
                    ],
                    'timeout' => 12,
                ]);

                if ($res->getStatusCode() >= 200 && $res->getStatusCode() < 300) {
                    Log::info("SendGrid test email with custom template sent successfully to {$adminEmail}");
                    return response()->json(['message' => "Test email with custom template styling sent via Twilio SendGrid to {$adminEmail}. Please check your inbox!"]);
                }
            } catch (\GuzzleHttp\Exception\ClientException $ge) {
                $respBody = (string) $ge->getResponse()?->getBody();
                Log::error("SendGrid API error: {$respBody}");
                if (str_contains($respBody, 'authorization') || $ge->getCode() === 401) {
                    return response()->json(['message' => 'SendGrid Authentication Failed (401). Please verify your SendGrid API Key.'], 422);
                } elseif (str_contains($respBody, 'Single Sender') || $ge->getCode() === 403) {
                    return response()->json(['message' => 'SendGrid Error (403): The From Email Address must be verified in Twilio SendGrid (Settings > Sender Authentication > Single Sender Verification).'], 422);
                }
                return response()->json(['message' => 'SendGrid API Error: ' . ($respBody ?: $ge->getMessage())], 422);
            } catch (\Exception $e) {
                Log::error("SendGrid exception: " . $e->getMessage());
                return response()->json(['message' => 'SendGrid Error: ' . $e->getMessage()], 422);
            }
        }

        if ($isResend) {
            try {
                $client = new \GuzzleHttp\Client();
                $fromHeader = $fromName ? "{$fromName} <" . ($fromAddr ?: 'onboarding@resend.dev') . ">" : ($fromAddr ?: 'onboarding@resend.dev');
                $res = $client->post('https://api.resend.com/emails', [
                    'headers' => [
                        'Authorization' => 'Bearer ' . $cleanPassword,
                        'Content-Type'  => 'application/json',
                    ],
                    'json' => [
                        'from'    => $fromHeader,
                        'to'      => [$adminEmail],
                        'subject' => "[{$fromName}] Notification: System Publishing Setup Verified",
                        'html'    => $htmlContent,
                        'text'    => "Hello {$adminName},\n\nThis is an official notification confirming that the JMCFI PostFlow publishing integration is active and operating normally.\n\nSincerely,\nJMCFI PostFlow System",
                    ],
                    'timeout' => 12,
                ]);

                if ($res->getStatusCode() >= 200 && $res->getStatusCode() < 300) {
                    Log::info("Resend test email with custom template sent successfully to {$adminEmail}");
                    return response()->json(['message' => "Test email with custom template styling sent via Resend API to {$adminEmail}. Please check your inbox!"]);
                }
            } catch (\GuzzleHttp\Exception\ClientException $ge) {
                $respBody = (string) $ge->getResponse()?->getBody();
                Log::error("Resend API error: {$respBody}");
                if ($ge->getCode() === 401 || str_contains(strtolower($respBody), 'api key')) {
                    return response()->json(['message' => 'Resend Authentication Failed (401). Please verify your Resend API Key (starts with re_).'], 422);
                } elseif ($ge->getCode() === 403 || str_contains(strtolower($respBody), 'domain') || str_contains(strtolower($respBody), 'not verified')) {
                    return response()->json(['message' => 'Resend Error (403): From Email Address domain is not verified in Resend. Please verify your domain in Resend (Domains > Add Domain) or use onboarding@resend.dev for testing.'], 422);
                }
                return response()->json(['message' => 'Resend API Error: ' . ($respBody ?: $ge->getMessage())], 422);
            } catch (\Exception $e) {
                Log::error("Resend exception: " . $e->getMessage());
                return response()->json(['message' => 'Resend Error: ' . $e->getMessage()], 422);
            }
        }

        try {
            Mail::send('emails.custom-template', $viewData, function ($message) use ($adminEmail, $adminName, $fromName) {
                $message->to($adminEmail, $adminName)
                        ->subject("[{$fromName}] Notification: System Publishing Setup Verified");
            });

            Log::info("Test email sent successfully to {$adminEmail}");

            return response()->json(['message' => "Test email with custom template styling sent to {$adminEmail}. Please check your inbox!"]);
        } catch (\Exception $e) {
            Log::error("Failed to send test email: " . $e->getMessage());
            $rawMsg = $e->getMessage();
            $lower = strtolower($rawMsg);

            if (str_contains($lower, '530') || str_contains($lower, '535') || str_contains($lower, '534') || str_contains($lower, 'authentication') || str_contains($lower, 'bad credentials')) {
                $errorMsg = 'Gmail Authentication Failed (530/535). Please double check your 16-character Gmail App Password and click "Save Settings".';
            } elseif (str_contains($lower, 'connection') || str_contains($lower, 'stream') || str_contains($lower, 'timeout') || str_contains($lower, 'refused')) {
                $errorMsg = "Could not connect to SMTP server ({$host}:{$port}). Railway/cloud hosting blocks outbound SMTP ports (587/465) by default to prevent spam. Consider using SendGrid API (Host: api.sendgrid.com) or an HTTP mail API for cloud environments.";
            } else {
                $errorMsg = "Test failed: {$rawMsg}";
            }

            return response()->json(['message' => $errorMsg], 422);
        }
    }

    /**
     * Apply mail configuration from database settings at runtime.
     */
    private function applyMailConfig(): void
    {
        $mailer   = SystemSetting::where('key', 'mail_mailer')->value('value')   ?? 'smtp';
        $host     = SystemSetting::where('key', 'mail_host')->value('value')     ?? 'smtp.gmail.com';
        $port     = SystemSetting::where('key', 'mail_port')->value('value')     ?? '587';
        $username = SystemSetting::where('key', 'mail_username')->value('value') ?? '';
        $password = SystemSetting::where('key', 'mail_password')->value('value') ?? '';
        $encrypt  = SystemSetting::where('key', 'mail_encryption')->value('value') ?? 'tls';
        $from     = SystemSetting::where('key', 'mail_from_address')->value('value') ?? 'postflow@jmc.edu.ph';
        $name     = SystemSetting::where('key', 'mail_from_name')->value('value')    ?? 'JMCFI PostFlow';

        $this->applyMailConfigCustom($mailer, $host, $port, $username, $password, $encrypt, $from, $name);
    }

    /**
     * Set dynamic runtime mail configuration with custom values.
     */
    private function applyMailConfigCustom(string $mailer, string $host, string $port, string $username, string $password, ?string $encrypt, string $from, string $name): void
    {
        // Strip spaces from app password if present (Gmail 16-char app passwords are often formatted as "xxxx xxxx xxxx xxxx")
        $cleanPassword = str_replace(' ', '', $password);

        // Auto-detect encryption if port is 465 (SSL) vs 587 (TLS)
        $effectiveEncryption = $encrypt;
        if ((int)$port === 465 && ($encrypt === 'tls' || empty($encrypt))) {
            $effectiveEncryption = 'ssl';
        } elseif ((int)$port === 587 && ($encrypt === 'ssl' || empty($encrypt))) {
            $effectiveEncryption = 'tls';
        }

        $isSendGrid = str_contains(strtolower($host), 'sendgrid') || str_starts_with($cleanPassword, 'SG.');
        $isResend   = str_contains(strtolower($host), 'resend')   || str_starts_with($cleanPassword, 're_');
        $isBrevo    = str_contains(strtolower($host), 'brevo')    || str_contains(strtolower($host), 'sendinblue') || str_starts_with($cleanPassword, 'xkeysib-');

        if ($isSendGrid) {
            Config::set('mail.default', 'sendgrid');
            Config::set('mail.mailers.sendgrid.transport', 'sendgrid');
            Config::set('mail.mailers.sendgrid.key', $cleanPassword);
        } elseif ($isResend) {
            Config::set('mail.default', 'resend');
            Config::set('mail.mailers.resend.transport', 'resend');
            Config::set('mail.mailers.resend.key', $cleanPassword);
        } elseif ($isBrevo) {
            Config::set('mail.default', 'brevo');
            Config::set('mail.mailers.brevo.transport', 'brevo');
            Config::set('mail.mailers.brevo.key', $cleanPassword);
        } else {
            Config::set('mail.default', $mailer);
            Config::set('mail.mailers.smtp.transport', 'smtp');
            Config::set('mail.mailers.smtp.host', $host);
            Config::set('mail.mailers.smtp.port', (int) $port);
            Config::set('mail.mailers.smtp.username', $username);
            Config::set('mail.mailers.smtp.password', $cleanPassword);
            Config::set('mail.mailers.smtp.encryption', $effectiveEncryption ?: null);
            Config::set('mail.mailers.smtp.timeout', 12);
            Config::set('mail.mailers.smtp.stream', [
                'ssl' => [
                    'allow_self_signed' => true,
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                ],
            ]);
        }

        Config::set('mail.from.address', $from ?: 'postflow@jmc.edu.ph');
        Config::set('mail.from.name', $name ?: 'JMCFI PostFlow');

        // Purge mailer instances so Laravel rebuilds transport with new config
        Mail::purge('sendgrid');
        Mail::purge('resend');
        Mail::purge('brevo');
        Mail::purge('smtp');
        Mail::purge($mailer);
        Mail::purge();
    }

    /**
     * Upload a custom email template image ('logo', 'banner', or 'content').
     */
    public function uploadLogo(Request $request): JsonResponse
    {
        if ($request->user()?->roleCategory() !== 'admin') {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'logo' => 'required|image|mimes:jpeg,png,jpg,webp,svg,gif|max:5120',
            'type' => 'nullable|string|in:logo,banner,content',
        ]);

        $type = in_array($request->input('type'), ['logo', 'banner', 'content'], true)
            ? $request->input('type')
            : 'logo';

        $file = $request->file('logo');
        $mime = $file->getMimeType() ?: 'image/png';
        $bytes = file_get_contents($file->getRealPath());

        $disk = config('filesystems.default') === 'local' ? 'public' : config('filesystems.default');
        $pathKey = "email_template_{$type}_path";
        $dataKey = "email_template_{$type}_data";
        $mimeKey = "email_template_{$type}_mime";
        $urlKey  = $type === 'content' ? 'email_template_content_image_url' : "email_template_{$type}_url";

        $oldPath = SystemSetting::where('key', $pathKey)->value('value');
        if ($oldPath && Storage::disk($disk)->exists($oldPath)) {
            Storage::disk($disk)->delete($oldPath);
        }

        $path = $file->store('email-logos', $disk);

        SystemSetting::updateOrCreate(
            ['key' => $pathKey],
            ['value' => $path, 'type' => 'string', 'description' => "Email template {$type} file path", 'is_public' => false]
        );
        SystemSetting::updateOrCreate(
            ['key' => $dataKey],
            ['value' => base64_encode($bytes), 'type' => 'string', 'description' => "Email template {$type} binary base64", 'is_public' => false]
        );
        SystemSetting::updateOrCreate(
            ['key' => $mimeKey],
            ['value' => $mime, 'type' => 'string', 'description' => "Email template {$type} mime type", 'is_public' => false]
        );

        $publicUrl = url("/api/email-template-image/{$type}") . '?v=' . time();

        SystemSetting::updateOrCreate(
            ['key' => $urlKey],
            ['value' => $publicUrl, 'type' => 'string', 'description' => "Mail setting: {$urlKey}", 'is_public' => false]
        );

        AuditLogService::log('EMAIL_TEMPLATE_' . strtoupper($type) . '_UPLOADED', "Uploaded custom email template {$type} image", 'INFO', [], $request);

        return response()->json([
            'message'  => ucfirst($type) . ' picture uploaded successfully.',
            'type'     => $type,
            'logo_url' => $publicUrl,
            'url'      => $publicUrl,
        ]);
    }

    /**
     * Remove a custom uploaded email template image ('logo', 'banner', or 'content').
     */
    public function removeLogo(Request $request): JsonResponse
    {
        if ($request->user()?->roleCategory() !== 'admin') {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $type = in_array($request->input('type'), ['logo', 'banner', 'content'], true)
            ? $request->input('type')
            : 'logo';

        $pathKey = "email_template_{$type}_path";
        $dataKey = "email_template_{$type}_data";
        $urlKey  = $type === 'content' ? 'email_template_content_image_url' : "email_template_{$type}_url";

        $disk = config('filesystems.default') === 'local' ? 'public' : config('filesystems.default');
        $oldPath = SystemSetting::where('key', $pathKey)->value('value');
        if ($oldPath && Storage::disk($disk)->exists($oldPath)) {
            Storage::disk($disk)->delete($oldPath);
        }

        SystemSetting::where('key', $pathKey)->update(['value' => '']);
        SystemSetting::where('key', $dataKey)->update(['value' => '']);
        SystemSetting::where('key', $urlKey)->update(['value' => '']);

        AuditLogService::log('EMAIL_TEMPLATE_' . strtoupper($type) . '_REMOVED', "Removed custom email template {$type} image", 'INFO', [], $request);

        return response()->json([
            'message'  => ucfirst($type) . ' picture removed successfully.',
            'type'     => $type,
            'logo_url' => '',
            'url'      => '',
        ]);
    }

    /**
     * Legacy public endpoint for the email template logo.
     */
    public function getLogo()
    {
        return $this->getTemplateImage('logo');
    }

    /**
     * Public endpoint to serve custom email template images ('logo', 'banner', or 'content').
     */
    public function getTemplateImage(string $type = 'logo')
    {
        if (!in_array($type, ['logo', 'banner', 'content'], true)) {
            abort(404);
        }

        $dataKey = "email_template_{$type}_data";
        $mimeKey = "email_template_{$type}_mime";
        $pathKey = "email_template_{$type}_path";

        $base64 = SystemSetting::where('key', $dataKey)->value('value');
        $mime = SystemSetting::where('key', $mimeKey)->value('value') ?: 'image/png';

        if (!empty($base64)) {
            $content = base64_decode($base64);
            return response($content, 200, [
                'Content-Type' => $mime,
                'Content-Length' => (string) strlen($content),
                'Cache-Control' => 'public, max-age=86400',
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Allow-Methods' => 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers' => '*',
            ]);
        }

        $path = SystemSetting::where('key', $pathKey)->value('value');
        if (!$path) {
            abort(404);
        }

        $path = str_replace('\\', '/', (string) $path);
        if ($path === '' || str_contains($path, '..') || str_starts_with($path, '/')) {
            abort(404);
        }

        $disk = config('filesystems.default') === 'local' ? 'public' : config('filesystems.default');

        try {
            if (! Storage::disk($disk)->exists($path)) {
                if ($disk !== 'public' && Storage::disk('public')->exists($path)) {
                    $disk = 'public';
                } else {
                    abort(404);
                }
            }

            $content = Storage::disk($disk)->get($path);
            $mimeType = Storage::disk($disk)->mimeType($path) ?: 'image/png';
        } catch (\Throwable) {
            abort(404);
        }

        return response($content, 200, [
            'Content-Type' => $mimeType,
            'Content-Length' => (string) strlen($content),
            'Cache-Control' => 'public, max-age=86400',
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers' => '*',
        ]);
    }
}
