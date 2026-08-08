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
        if (request()->user()?->role !== 'admin') {
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
        if ($request->user()?->role !== 'admin') {
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
     */
    public function sendTestEmail(Request $request): JsonResponse
    {
        if ($request->user()?->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        // Temporarily override mail config from database settings
        $this->applyMailConfig();

        $adminEmail = $request->user()->email;
        $adminName  = $request->user()->full_name;

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
            return response()->json(['message' => 'Failed to send test email: ' . $e->getMessage()], 422);
        }
    }

    /**
     * Apply mail configuration from database settings at runtime.
     */
    private function applyMailConfig(): void
    {
        $mailer   = SystemSetting::where('key', 'mail_mailer')->value('value')   ?? 'log';
        $host     = SystemSetting::where('key', 'mail_host')->value('value')     ?? 'smtp.gmail.com';
        $port     = SystemSetting::where('key', 'mail_port')->value('value')     ?? '587';
        $username = SystemSetting::where('key', 'mail_username')->value('value') ?? '';
        $password = SystemSetting::where('key', 'mail_password')->value('value') ?? '';
        $encrypt  = SystemSetting::where('key', 'mail_encryption')->value('value') ?? 'tls';
        $from     = SystemSetting::where('key', 'mail_from_address')->value('value') ?? 'postflow@jmc.edu.ph';
        $name     = SystemSetting::where('key', 'mail_from_name')->value('value')    ?? 'JMCFI PostFlow';

        Config::set('mail.default', $mailer);
        Config::set('mail.mailers.smtp.host', $host);
        Config::set('mail.mailers.smtp.port', (int) $port);
        Config::set('mail.mailers.smtp.username', $username);
        Config::set('mail.mailers.smtp.password', $password);
        Config::set('mail.mailers.smtp.encryption', $encrypt ?: null);
        Config::set('mail.from.address', $from);
        Config::set('mail.from.name', $name);
    }
}
