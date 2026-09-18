<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

class AIProviderSettings
{
    public const PROVIDERS = [
        'deepseek' => ['name' => 'DeepSeek', 'url' => 'https://api.deepseek.com/v1'],
        'openai' => ['name' => 'OpenAI', 'url' => 'https://api.openai.com/v1'],
        'gemini' => ['name' => 'Google Gemini', 'url' => 'https://generativelanguage.googleapis.com/v1beta/openai'],
        'groq' => ['name' => 'Groq', 'url' => 'https://api.groq.com/openai/v1'],
        'openrouter' => ['name' => 'OpenRouter', 'url' => 'https://openrouter.ai/api/v1'],
    ];

    public function current(): array
    {
        $stored = SystemSetting::where('key', 'ai_provider_settings')->first();
        if ($stored) {
            return json_decode(Crypt::decryptString($stored->value), true, 512, JSON_THROW_ON_ERROR);
        }

        $legacy = SystemSetting::where('key', 'deepseek_api_key')->first();
        return [
            'provider' => 'deepseek',
            'model' => (string) config('ai.legacy_model', 'deepseek-chat'),
            'api_key' => $legacy ? ($legacy->value ? Crypt::decryptString($legacy->value) : '')
                : (string) config('ai.legacy_key', ''),
            'verified_at' => null,
        ];
    }

    public function publicSettings(): array
    {
        $settings = $this->current();
        return [
            'provider' => $settings['provider'],
            'model' => $settings['model'],
            'configured' => $settings['api_key'] !== '',
            'verified_at' => $settings['verified_at'] ?? null,
            'providers' => collect(self::PROVIDERS)->map(fn ($value, $id) => [
                'id' => $id, 'name' => $value['name'],
            ])->values()->all(),
        ];
    }

    public function save(array $settings): void
    {
        DB::transaction(function () use ($settings) {
            SystemSetting::updateOrCreate(['key' => 'ai_provider_settings'], [
                'value' => Crypt::encryptString(json_encode($settings, JSON_THROW_ON_ERROR)),
                'type' => 'string', 'description' => 'AI provider credentials', 'is_public' => false,
            ]);
            SystemSetting::where('key', 'deepseek_api_key')->delete();
        });
    }
}
