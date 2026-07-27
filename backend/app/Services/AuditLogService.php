<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

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
    public static function log(string $eventType, string $description, string $severity = 'INFO', ?array $payload = null, ?Request $request = null)
    {
        $user = Auth::user();

        AuditLog::create([
            'user_id' => $user ? $user->id : null,
            'event_type' => $eventType,
            'description' => $description,
            'ip_address' => $request ? $request->ip() : request()->ip(),
            'device' => $request ? $request->userAgent() : request()->userAgent(),
            'severity' => $severity,
            'payload' => $payload,
        ]);
    }
}
