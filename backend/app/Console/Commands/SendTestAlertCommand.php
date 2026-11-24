<?php

namespace App\Console\Commands;

use App\Models\SystemSetting;
use App\Services\SystemAlertService;
use Illuminate\Console\Command;

class SendTestAlertCommand extends Command
{
    protected $signature = 'alert:test 
                            {--bot-token= : Telegram bot token to test or store}
                            {--chat-id= : Telegram chat ID to test or store}
                            {--webhook= : Webhook URL to test or store}';

    protected $description = 'Test or configure Telegram and Webhook security alerts from CLI without exposing to UI';

    public function handle(): int
    {
        $botToken = $this->option('bot-token');
        $chatId = $this->option('chat-id');
        $webhook = $this->option('webhook');

        if ($botToken) {
            SystemSetting::updateOrCreate(['key' => 'telegram_bot_token'], ['value' => $botToken]);
            $this->info("Saved Telegram bot token securely.");
        }

        if ($chatId) {
            SystemSetting::updateOrCreate(['key' => 'telegram_chat_id'], ['value' => $chatId]);
            $this->info("Saved Telegram chat ID securely.");
        }

        if ($webhook) {
            SystemSetting::updateOrCreate(['key' => 'alert_webhook_url'], ['value' => $webhook]);
            $this->info("Saved Alert webhook URL securely.");
        }

        $activeBotToken = SystemAlertService::getTelegramBotToken();
        $activeChatId = SystemAlertService::getTelegramChatId();
        $activeWebhook = SystemAlertService::getAlertWebhookUrl();

        $this->info("--- Current Alert Monitor Configuration ---");
        $this->line("Telegram Bot Token: " . ($activeBotToken ? substr($activeBotToken, 0, 8) . '...' : 'Not configured'));
        $this->line("Telegram Chat ID:   " . ($activeChatId ?: 'Not configured'));
        $this->line("Alert Webhook URL:  " . ($activeWebhook ?: 'Not configured'));

        if (empty($activeBotToken) && empty($activeWebhook)) {
            $this->warn("No Telegram Bot Token or Webhook URL found. Set via environment variable (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ALERT_WEBHOOK_URL) or pass options (--bot-token, --chat-id, --webhook).");
            return 1;
        }

        $this->info("Sending test alert...");
        SystemAlertService::dispatch(
            title: "🔔 TEST ALERT: Telegram & Webhook System Online",
            description: "This is a verification test from JMCFI PostFlow security monitoring system. If you received this, vacation security alerts and intruder warnings are fully active!",
            level: 'INFO',
            details: [
                'triggered_by' => 'CLI artisan alert:test',
                'server_time' => now()->toIso8601String(),
            ]
        );

        $this->info("Test alert dispatched successfully!");
        return 0;
    }
}
