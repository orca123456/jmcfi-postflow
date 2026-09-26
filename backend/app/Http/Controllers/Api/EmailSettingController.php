<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Config;

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
            'mail_mailer'       => 'required|string|in:smtp,log,sendmail',
            'mail_host'         => 'nullable|string|max:255',
            'mail_port'         => 'nullable|string|max:10',
            'mail_username'     => 'nullable|string|max:255',
            'mail_password'     => 'nullable|string|max:255',
            'mail_encryption'   => 'nullable|string|in:tls,ssl,',
            'mail_from_address' => 'nullable|email|max:255',
            'mail_from_name'    => 'nullable|string|max:255',
        ]);

        foreach ($this->allowedKeys as $key) {
            if (isset($validated[$key])) {
                SystemSetting::updateOrCreate(
                    ['key' => $key],
                    ['value' => $validated[$key], 'type' => 'string', 'description' => "Mail setting: {$key}", 'is_public' => false]
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

        $isSendGrid = str_contains(strtolower($host), 'sendgrid') || str_starts_with($cleanPassword, 'SG.');

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
                        'subject' => '[JMCFI PostFlow] ✅ Test Email — Configuration Successful!',
                        'content' => [
                            [
                                'type'  => 'text/plain',
                                'value' => "Hello {$adminName},\n\nThis is a test email sent via Twilio SendGrid API from JMCFI PostFlow.\n\nIf you received this, your SendGrid integration is working correctly!\n\n— JMCFI PostFlow System"
                            ]
                        ]
                    ],
                    'timeout' => 12,
                ]);

                if ($res->getStatusCode() >= 200 && $res->getStatusCode() < 300) {
                    Log::info("SendGrid test email sent successfully to {$adminEmail}");
                    return response()->json(['message' => "Test email sent via Twilio SendGrid to {$adminEmail}. Please check your inbox!"]);
                }
            } catch (\GuzzleHttp\Exception\ClientException $ge) {
                $respBody = (string) $ge->getResponse()?->getBody();
                Log::error("SendGrid API error: {$respBody}");
                if (str_contains($respBody, 'authorization') || $ge->getCode() === 401) {
                    return response()->json(['message' => 'SendGrid Authentication Failed (401). Please verify your SendGrid API Key.'], 422);
                } elseif (str_contains($respBody, 'Single Sender') || $ge->getCode() === 403) {
                    return response()->json(['message' => 'SendGrid Error: The From Email Address must be verified in Twilio SendGrid (Single Sender Verification).'], 422);
                }
                return response()->json(['message' => 'SendGrid API Error: ' . ($respBody ?: $ge->getMessage())], 422);
            } catch (\Exception $e) {
                Log::error("SendGrid exception: " . $e->getMessage());
                return response()->json(['message' => 'SendGrid Error: ' . $e->getMessage()], 422);
            }
        }

        try {
            Mail::raw(
                "Hello {$adminName},\n\nThis is a test email from JMCFI PostFlow.\n\nIf you received this, your email configuration is working correctly!\n\n— JMCFI PostFlow System",
                function ($message) use ($adminEmail, $adminName) {
                    $message->to($adminEmail, $adminName)
                            ->subject('[JMCFI PostFlow] ✅ Test Email — Configuration Successful!');
                }
            );

            Log::info("Test email sent successfully to {$adminEmail}");

            return response()->json(['message' => "Test email sent to {$adminEmail}. Please check your inbox!"]);
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
        Config::set('mail.from.address', $from ?: 'postflow@jmc.edu.ph');
        Config::set('mail.from.name', $name ?: 'JMCFI PostFlow');

        // Purge mailer instances so Laravel rebuilds transport with new config
        Mail::purge('smtp');
        Mail::purge($mailer);
        Mail::purge();
    }
}
