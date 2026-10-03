<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Queue;
use Throwable;

class HealthCheckController extends Controller
{
    public function check(): JsonResponse
    {
        $startTime = microtime(true);
        $checks = [
            'database' => ['status' => 'unknown'],
            'storage' => ['status' => 'unknown'],
            'queue' => ['status' => 'unknown'],
        ];

        $overallHealthy = true;

        // 1. Database Connectivity & Latency
        try {
            $dbStart = microtime(true);
            DB::select('SELECT 1');
            $dbLatencyMs = round((microtime(true) - $dbStart) * 1000, 2);
            $checks['database'] = [
                'status' => 'healthy',
                'latency_ms' => $dbLatencyMs,
            ];
        } catch (Throwable $e) {
            $overallHealthy = false;
            $checks['database'] = [
                'status' => 'unhealthy',
                'error' => $e->getMessage(),
            ];
        }

        // 2. Storage Writable
        try {
            $testFile = 'health_check_' . time() . '.tmp';
            Storage::disk('public')->put($testFile, 'ok');
            $readBack = Storage::disk('public')->get($testFile);
            Storage::disk('public')->delete($testFile);

            $checks['storage'] = [
                'status' => ($readBack === 'ok') ? 'healthy' : 'unhealthy',
                'disk' => 'public',
            ];
        } catch (Throwable $e) {
            $overallHealthy = false;
            $checks['storage'] = [
                'status' => 'unhealthy',
                'error' => $e->getMessage(),
            ];
        }

        // 3. Queue Driver Check
        try {
            $defaultQueue = config('queue.default');
            $checks['queue'] = [
                'status' => 'healthy',
                'driver' => $defaultQueue,
            ];
        } catch (Throwable $e) {
            $checks['queue'] = [
                'status' => 'warning',
                'error' => $e->getMessage(),
            ];
        }

        $totalTimeMs = round((microtime(true) - $startTime) * 1000, 2);

        return response()->json([
            'status' => $overallHealthy ? 'healthy' : 'degraded',
            'timestamp' => now()->toIso8601String(),
            'response_time_ms' => $totalTimeMs,
            'checks' => $checks,
            'environment' => config('app.env'),
            'version' => '1.0.0',
        ], $overallHealthy ? 200 : 503);
    }
}
