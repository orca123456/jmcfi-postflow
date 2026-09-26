<?php

namespace App\Providers;

use App\Models\SystemSetting;
use App\Mail\SendGridTransport;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Strict database/model safety — only in non-production to prevent
        // LazyLoadingViolationException crashes when $appends access unloaded relations.
        Model::shouldBeStrict(!$this->app->environment('production'));

        // Enforce HTTPS URLs in production
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        // Register custom SendGrid HTTP Transport
        Mail::extend('sendgrid', function (array $config = []) {
            $apiKey = $config['key'] ?? (Schema::hasTable('system_settings') ? SystemSetting::where('key', 'mail_password')->value('value') : '') ?? '';
            return new SendGridTransport((string) $apiKey);
        });

        // Apply system-wide runtime mail configuration for all system notifications
        try {
            if (Schema::hasTable('system_settings')) {
                $mailer   = SystemSetting::where('key', 'mail_mailer')->value('value')   ?? 'smtp';
                $host     = SystemSetting::where('key', 'mail_host')->value('value')     ?? 'smtp.gmail.com';
                $port     = SystemSetting::where('key', 'mail_port')->value('value')     ?? '587';
                $username = SystemSetting::where('key', 'mail_username')->value('value') ?? '';
                $password = SystemSetting::where('key', 'mail_password')->value('value') ?? '';
                $encrypt  = SystemSetting::where('key', 'mail_encryption')->value('value') ?? 'tls';
                $from     = SystemSetting::where('key', 'mail_from_address')->value('value') ?? 'postflow@jmc.edu.ph';
                $name     = SystemSetting::where('key', 'mail_from_name')->value('value')    ?? 'JMCFI PostFlow';

                $cleanPassword = str_replace(' ', '', $password);
                $isSendGrid = str_contains(strtolower($host), 'sendgrid') || str_starts_with($cleanPassword, 'SG.');

                if ($isSendGrid) {
                    Config::set('mail.default', 'sendgrid');
                    Config::set('mail.mailers.sendgrid.transport', 'sendgrid');
                    Config::set('mail.mailers.sendgrid.key', $cleanPassword);
                } else {
                    Config::set('mail.default', $mailer);
                    Config::set('mail.mailers.smtp.transport', 'smtp');
                    Config::set('mail.mailers.smtp.host', $host);
                    Config::set('mail.mailers.smtp.port', (int) $port);
                    Config::set('mail.mailers.smtp.username', $username);
                    Config::set('mail.mailers.smtp.password', $cleanPassword);
                    Config::set('mail.mailers.smtp.encryption', $encrypt ?: null);
                    Config::set('mail.mailers.smtp.timeout', 12);
                    Config::set('mail.mailers.smtp.stream', [
                        'ssl' => [
                            'allow_self_signed' => true,
                            'verify_peer' => false,
                            'verify_peer_name' => false,
                        ],
                    ]);
                }

                Config::set('mail.from.address', $from ?: 'postflow@jmc.edu.ph');
                Config::set('mail.from.name', $name ?: 'JMCFI PostFlow');
            }
        } catch (\Throwable $e) {
            // DB not ready during migration/setup
        }
    }
}
