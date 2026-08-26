<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $query = AuditLog::with('user.roles')->orderBy('created_at', 'desc');

        if ($request->filled('event_type') && $request->event_type !== 'ALL') {
            $query->where('event_type', $request->event_type);
        }

        if ($request->filled('search')) {
            $search = (string) $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('event_type', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($userQuery) use ($search) {
                        $userQuery->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $perPage = min(max((int) $request->get('per_page', 100), 1), 200);
        $logs = $query->paginate($perPage);

        $mappedLogs = $logs->map(function ($log) {
            $style = $this->eventStyle($log->event_type, $log->severity);

            return [
                'id' => 'log-' . $log->id,
                'timestamp' => $log->created_at->format('M d, Y - h:i:s A'),
                'userName' => $log->user ? $log->user->full_name : 'System',
                'userEmail' => $log->user ? $log->user->email : '',
                'userRole' => $log->user && $log->user->roles->count() > 0 ? ($log->user->roles->first()->display_name ?? $log->user->roles->first()->name) : 'User',
                'initials' => $log->user ? substr($log->user->first_name, 0, 1) . substr($log->user->last_name, 0, 1) : 'S',
                'avatarBg' => '#0B2545',
                'eventType' => $log->event_type,
                'badgeBg' => $style['bg'],
                'badgeColor' => $style['color'],
                'description' => $log->description,
                'ipAddress' => $log->ip_address,
                'device' => $log->device,
                'severity' => $log->severity,
                'severityBg' => $log->severity === 'ERROR' ? '#FEE2E2' : '#EFF6FF',
                'severityColor' => $log->severity === 'ERROR' ? '#991B1B' : '#1E40AF',
                'payload' => $log->payload ? json_encode($log->payload, JSON_PRETTY_PRINT) : null,
            ];
        });

        return response()->json([
            'data' => $mappedLogs,
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    private function eventStyle(string $eventType, string $severity): array
    {
        if ($severity === 'ERROR') {
            return ['bg' => '#FEE2E2', 'color' => '#991B1B'];
        }

        if (str_contains($eventType, 'LOGIN')) {
            return ['bg' => '#DBEAFE', 'color' => '#1D4ED8'];
        }

        if (str_contains($eventType, 'CONTENT_APPROVAL') || str_contains($eventType, 'SUBMITTED')) {
            return ['bg' => '#DCFCE7', 'color' => '#166534'];
        }

        if (str_contains($eventType, 'REJECT') || str_contains($eventType, 'DELETED') || $severity === 'WARNING') {
            return ['bg' => '#FEF3C7', 'color' => '#92400E'];
        }

        if (str_contains($eventType, 'USER')) {
            return ['bg' => '#E0E7FF', 'color' => '#3730A3'];
        }

        if (str_contains($eventType, 'TOKEN') || str_contains($eventType, 'SETTINGS')) {
            return ['bg' => '#FCE7F3', 'color' => '#BE185D'];
        }

        return ['bg' => '#F3E8FF', 'color' => '#7C3AED'];
    }
}
