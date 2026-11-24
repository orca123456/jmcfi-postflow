<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SystemAlertService
{
    /**
     * Dispatch an alert to Telegram and/or custom Webhook.
     * Guaranteed non-blocking and exception-safe.
     */
    public static function dispatch(
        string $title,
        string $description,
        string $level = 'WARNING',
        ?array $details = null,
        ?string $ipAddress = null
    ): void {
        try {
            $botToken = self::getTelegramBotToken();
            $chatId = self::getTelegramChatId();
            $webhookUrl = self::getAlertWebhookUrl();

            // If neither Telegram nor Webhook is configured, skip silently
            if (empty($botToken) && empty($chatId) && empty($webhookUrl)) {
                return;
            }

            // Deduplicate rapid identical alerts to prevent notification spamming
            $cacheKey = 'sys_alert_dedup:' . md5($title . ($details['email'] ?? '') . ($ipAddress ?? ''));
            if (!Cache::add($cacheKey, 1, now()->addSeconds(30))) {
                return;
            }

            // 1. Dispatch to Telegram
            if (!empty($botToken) && !empty($chatId)) {
                self::sendTelegramMessage($botToken, $chatId, $title, $description, $level, $details, $ipAddress);
            }

            // 2. Dispatch to Generic Webhook (Discord, Slack, or Custom Agent Webhook)
            if (!empty($webhookUrl)) {
                self::sendWebhookPayload($webhookUrl, $title, $description, $level, $details, $ipAddress);
            }
        } catch (\Throwable $e) {
            Log::warning('SystemAlertService dispatch failed: ' . $e->getMessage());
        }
    }

    /**
     * Dispatch an emergency security attack alert.
     */
    public static function alertSecurity(
        string $eventType,
        string $description,
        ?string $ipAddress = null,
        ?array $details = null
    ): void {
        self::dispatch(
            title: "🚨 SECURITY ALERT: {$eventType}",
            description: $description,
            level: 'CRITICAL',
            details: $details,
            ipAddress: $ipAddress
        );
    }

    /**
     * Dispatch a system error or crash alert.
     */
    public static function alertError(
        string $errorTitle,
        string $errorMessage,
        ?array $details = null
    ): void {
        self::dispatch(
            title: "⚠️ SYSTEM ERROR: {$errorTitle}",
            description: $errorMessage,
            level: 'ERROR',
            details: $details
        );
    }

    /**
     * Format and send an HTML message to Telegram.
     */
    private static function sendTelegramMessage(
        string $botToken,
        string $chatId,
        string $title,
        string $description,
        string $level,
        ?array $details,
        ?string $ipAddress
    ): void {
        $icon = match (strtoupper($level)) {
            'CRITICAL', 'DANGER' => '🚨',
            'ERROR' => '❌',
            'WARNING' => '⚠️',
            default => 'ℹ️',
        };

        $time = now()->timezone('Asia/Manila')->format('Y-m-d H:i:s T');
        $environment = config('app.env', 'production');

        $html = "<b>{$icon} JMCFI PostFlow Alert</b>\n";
        $html .= "<b>Title:</b> " . htmlspecialchars($title) . "\n";
        $html .= "<b>Severity:</b> " . htmlspecialchars($level) . "\n";
        $html .= "<b>Time:</b> <code>{$time}</code>\n";
        $html .= "<b>Environment:</b> <code>{$environment}</code>\n";

        if ($ipAddress) {
            $html .= "<b>Source IP:</b> <code>" . htmlspecialchars($ipAddress) . "</code>\n";
        }

        $html .= "\n<b>Details:</b>\n" . htmlspecialchars($description) . "\n";

        if (!empty($details)) {
            $html .= "\n<b>Payload:</b>\n";
            $preview = json_encode($details, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            if (strlen($preview) > 1000) {
                $preview = substr($preview, 0, 1000) . '... [truncated]';
            }
            $html .= "<pre>" . htmlspecialchars($preview) . "</pre>";
        }

        Http::timeout(5)
            ->post("https://api.telegram.org/bot{$botToken}/sendMessage", [
                'chat_id' => $chatId,
                'text' => $html,
                'parse_mode' => 'HTML',
                'disable_web_page_preview' => true,
            ]);
    }

    /**
     * Send structured JSON payload to an external webhook.
     */
    private static function sendWebhookPayload(
        string $webhookUrl,
        string $title,
        string $description,
        string $level,
        ?array $details,
        ?string $ipAddress
    ): void {
        $payload = [
            'app' => 'JMCFI PostFlow',
            'environment' => config('app.env', 'production'),
            'timestamp' => now()->toIso8601String(),
            'title' => $title,
            'description' => $description,
            'severity' => $level,
            'ip_address' => $ipAddress,
            'details' => $details,
        ];

        // Discord webhook compatibility:
        if (str_contains($webhookUrl, 'discord.com/api/webhooks')) {
            $color = match (strtoupper($level)) {
                'CRITICAL', 'DANGER' => 0xFF0000,
                'ERROR' => 0xFFA500,
                'WARNING' => 0xFFFF00,
                default => 0x0099FF,
            };

            $discordPayload = [
                'embeds' => [
                    [
                        'title' => $title,
                        'description' => $description,
                        'color' => $color,
                        'fields' => [
                            ['name' => 'Severity', 'value' => $level, 'inline' => true],
                            ['name' => 'IP Address', 'value' => $ipAddress ?? 'N/A', 'inline' => true],
                        ],
                        'footer' => ['text' => 'JMCFI PostFlow Security Monitor'],
                        'timestamp' => now()->toIso8601String(),
                    ]
                ]
            ];

            Http::timeout(5)->post($webhookUrl, $discordPayload);
            return;
        }

        Http::timeout(5)->post($webhookUrl, $payload);
    }

    /**
     * Get Telegram Bot Token from environment or secure settings.
     */
    public static function getTelegramBotToken(): ?string
    {
        $token = env('TELEGRAM_BOT_TOKEN');
        if (!empty($token)) {
            return (string) $token;
        }

        $setting = SystemSetting::where('key', 'telegram_bot_token')->first();
        return $setting ? (string) $setting->value : null;
    }

    /**
     * Get Telegram Chat ID from environment or secure settings.
     */
    public static function getTelegramChatId(): ?string
    {
        $chatId = env('TELEGRAM_CHAT_ID');
        if (!empty($chatId)) {
            return (string) $chatId;
        }

        $setting = SystemSetting::where('key', 'telegram_chat_id')->first();
        return $setting ? (string) $setting->value : null;
    }

    /**
     * Get Alert Webhook URL from environment or secure settings.
     */
    public static function getAlertWebhookUrl(): ?string
    {
        $url = env('ALERT_WEBHOOK_URL');
        if (!empty($url)) {
            return (string) $url;
        }

        $setting = SystemSetting::where('key', 'alert_webhook_url')->first();
        return $setting ? (string) $setting->value : null;
    }
}
