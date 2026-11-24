<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SystemSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'key',
        'value',
        'type',
        'description',
        'is_public',
    ];

    protected function casts(): array
    {
        return [
            'is_public' => 'boolean',
        ];
    }

    /**
     * Get platform availability and configuration status.
     * Checks both database system_settings and fallback environment variables.
     */
    public static function getPlatformAvailability(): array
    {
        $keys = [
            'facebook_page_id', 'facebook_access_token', 'facebook_credentials_verified',
            'instagram_business_account_id', 'instagram_access_token', 'instagram_credentials_verified',
            'wordpress_url', 'wordpress_username', 'wordpress_app_password', 'wordpress_credentials_verified',
        ];

        $settings = static::whereIn('key', $keys)->pluck('value', 'key');

        $fbConfigured = (!empty(trim((string) ($settings->get('facebook_page_id') ?? ''))) 
            && !empty(trim((string) ($settings->get('facebook_access_token') ?? ''))))
            || (!empty(env('FACEBOOK_PAGE_ID')) && !empty(env('FACEBOOK_PAGE_ACCESS_TOKEN')));

        $igConfigured = (!empty(trim((string) ($settings->get('instagram_business_account_id') ?? ''))) 
            && !empty(trim((string) ($settings->get('instagram_access_token') ?? ''))))
            || (!empty(env('INSTAGRAM_BUSINESS_ACCOUNT_ID')) && !empty(env('INSTAGRAM_ACCESS_TOKEN')));

        $wpConfigured = (!empty(trim((string) ($settings->get('wordpress_url') ?? ''))) 
            && !empty(trim((string) ($settings->get('wordpress_username') ?? ''))) 
            && !empty(trim((string) ($settings->get('wordpress_app_password') ?? ''))));

        return [
            'facebook' => [
                'name' => 'Facebook',
                'configured' => $fbConfigured,
                'verified' => $settings->get('facebook_credentials_verified') === '1',
            ],
            'instagram' => [
                'name' => 'Instagram',
                'configured' => $igConfigured,
                'verified' => $settings->get('instagram_credentials_verified') === '1',
            ],
            'wordpress' => [
                'name' => 'Website (WordPress)',
                'configured' => $wpConfigured,
                'verified' => $settings->get('wordpress_credentials_verified') === '1',
            ],
        ];
    }

    /**
     * Check if a specific target platform is configured and ready.
     */
    public static function isPlatformConfigured(string $platform): bool
    {
        $norm = strtolower(trim($platform));
        $availability = static::getPlatformAvailability();

        if ($norm === 'facebook') {
            return (bool) ($availability['facebook']['configured'] ?? false);
        }
        if ($norm === 'instagram') {
            return (bool) ($availability['instagram']['configured'] ?? false);
        }
        if (in_array($norm, ['wordpress', 'website', 'portal', 'wp'], true)) {
            return (bool) ($availability['wordpress']['configured'] ?? false);
        }

        return false;
    }
}