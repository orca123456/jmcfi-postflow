<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogService;
use App\Services\AIProviderSettings;
use App\Services\AIClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AISettingController extends Controller
{
    public function __construct(private AIProviderSettings $settings, private AIClient $client) {}

    public function show(): JsonResponse
    {
        return response()->json($this->settings->publicSettings());
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'provider' => ['required', Rule::in(array_keys(AIProviderSettings::PROVIDERS))],
            'model' => ['required', 'string', 'max:200', 'regex:/\A[a-zA-Z0-9][a-zA-Z0-9._:\/\-]*\z/'],
            'api_key' => ['nullable', 'string', 'max:2048', 'regex:/\A[^\r\n]+\z/'],
        ]);
        $current = $this->settings->current();
        $key = trim($data['api_key'] ?? '');
        if ($key === '' && $data['provider'] === $current['provider']) {
            $key = $current['api_key'];
        }
        if ($key === '') {
            throw ValidationException::withMessages(['api_key' => 'Enter an API key for the selected provider.']);
        }
        $candidate = ['provider' => $data['provider'], 'model' => $data['model'], 'api_key' => $key];
        try {
            $this->client->verify($candidate);
        } catch (\RuntimeException $e) {
            throw ValidationException::withMessages(['api_key' => $e->getMessage() . ' Previous settings were kept.']);
        }
        $candidate['verified_at'] = now()->toIso8601String();
        $this->settings->save($candidate);
        AuditLogService::log('AI_SETTINGS_UPDATED', 'Updated AI provider settings', 'WARNING', [
            'provider' => $data['provider'], 'model' => $data['model'],
        ], $request);
        return $this->show();
    }

    public function clear(Request $request): JsonResponse
    {
        $current = $this->settings->current();
        $this->settings->save(array_merge($current, ['api_key' => '', 'verified_at' => null]));
        AuditLogService::log('AI_SETTINGS_CLEARED', 'Cleared AI credentials', 'WARNING', [], $request);
        return $this->show();
    }
}
