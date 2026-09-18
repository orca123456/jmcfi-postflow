<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class AIClient
{
    public function __construct(private AIProviderSettings $settings) {}

    public function complete(array $messages, ?array $settings = null, bool $json = false): array
    {
        // Resolve on every call so long-running workers also pick up replacements.
        $settings ??= $this->settings->current();
        if (empty($settings['api_key'])) {
            throw new RuntimeException('AI is not configured. Ask an administrator to save an API key.');
        }
        $provider = AIProviderSettings::PROVIDERS[$settings['provider']] ?? null;
        if (!$provider) {
            throw new RuntimeException('The selected AI provider is unsupported.');
        }
        $payload = ['model' => $settings['model'], 'messages' => $messages];
        $payload[$settings['provider'] === 'openai' ? 'max_completion_tokens' : 'max_tokens'] = 4096;
        if ($json) {
            $payload['response_format'] = ['type' => 'json_object'];
        }

        try {
            $response = Http::withToken($settings['api_key'])->acceptJson()
                ->connectTimeout(10)->timeout(45)->withoutRedirecting()
                ->post($provider['url'] . '/chat/completions', $payload);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Cannot reach the AI provider. Please try again.');
        }

        if (!$response->successful()) {
            $reason = match ($response->status()) {
                401, 403 => 'The API key was rejected or does not have access to this model.',
                402 => 'The AI account needs credits.',
                429 => 'The AI account has reached its rate or usage limit.',
                400, 404, 422 => 'Check the model ID and whether it supports chat completions and JSON output.',
                default => 'The AI provider is temporarily unavailable.',
            };
            throw new RuntimeException($reason . ' (HTTP ' . $response->status() . ')');
        }
        $content = $response->json('choices.0.message.content');
        if (!is_string($content) || trim($content) === '' || $response->json('choices.0.finish_reason') === 'length') {
            throw new RuntimeException('The AI model did not return a complete text response. Try another model.');
        }
        return [
            'content' => $content,
            'tokens_used' => (int) $response->json('usage.total_tokens', 0),
            'model' => $settings['model'],
            'provider' => $settings['provider'],
        ];
    }

    public function verify(array $settings): void
    {
        $result = $this->complete([
            ['role' => 'system', 'content' => 'Return only valid JSON.'],
            ['role' => 'user', 'content' => 'Connection test. Return exactly {"ok":true}.'],
        ], $settings, true);
        $json = json_decode($result['content'], true);
        if (!is_array($json) || ($json['ok'] ?? null) !== true) {
            throw new RuntimeException('The model did not return the required JSON format. Try another chat model.');
        }
    }
}
