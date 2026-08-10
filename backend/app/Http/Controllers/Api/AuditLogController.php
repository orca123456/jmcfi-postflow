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
        
        $logs = $query->paginate(50);
        
        // Transform the data to match frontend expectations
        $mappedLogs = $logs->map(function ($log) {
            return [
                'id' => 'log-' . $log->id,
                'timestamp' => $log->created_at->format('M d, Y • h:i:s A'),
                'userName' => $log->user ? $log->user->full_name : 'System',
                'userEmail' => $log->user ? $log->user->email : '',
                'userRole' => $log->user && $log->user->roles->count() > 0 ? $log->user->roles->first()->display_name : 'User',
                'initials' => $log->user ? substr($log->user->first_name, 0, 1) . substr($log->user->last_name, 0, 1) : 'S',
                'avatarBg' => '#0B2545',
                'eventType' => $log->event_type,
                'badgeBg' => $log->event_type === 'CONTENT_APPROVAL' ? '#DCFCE7' : ($log->event_type === 'CONTENT_REJECT' ? '#FEE2E2' : '#F3E8FF'),
                'badgeColor' => $log->event_type === 'CONTENT_APPROVAL' ? '#166534' : ($log->event_type === 'CONTENT_REJECT' ? '#991B1B' : '#7C3AED'),
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
                'total' => $logs->total()
            ]
        ]);
    }
}
