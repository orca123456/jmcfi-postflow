<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class AuditLogService
{
    /**
     * Log an audit event.
     *
     * @param string $eventType
     * @param string $description
     * @param string $severity INFO, WARNING, ERROR
     * @param array|null $payload
     * @param Request|null $request
     * @return void
     */
    public static function log(string $eventType, string $description, string $severity = 'INFO', ?array $payload = null, ?Request $request = null): void
    {
        self::logForUser(Auth::user(), $eventType, $description, $severity, $payload, $request);
    }

    public static function logForUser(?User $user, string $eventType, string $description, string $severity = 'INFO', ?array $payload = null, ?Request $request = null): void
    {
        try {
            $request ??= request();

            AuditLog::create([
                'user_id' => $user?->id,
                'event_type' => $eventType,
                'description' => $description,
                'ip_address' => $request->ip(),
                'device' => substr((string) $request->userAgent(), 0, 500),
                'severity' => $severity,
                'payload' => self::sanitizePayload($payload),
            ]);
        } catch (\Throwable $e) {
            Log::warning('Audit log write failed: ' . $e->getMessage());
        }
    }

    private static function sanitizePayload(?array $payload): ?array
    {
        if ($payload === null) {
            return null;
        }

        $blocked = ['password', 'password_confirmation', 'current_password', 'new_password', 'new_password_confirmation', 'token', 'access_token', 'facebook_access_token', 'instagram_access_token', 'wordpress_app_password'];

        foreach ($payload as $key => $value) {
            if (in_array(strtolower((string) $key), $blocked, true)) {
                $payload[$key] = '[hidden]';
                continue;
            }

            if (is_array($value)) {
                $payload[$key] = self::sanitizePayload($value);
            }
        }

        return $payload;
    }
}
