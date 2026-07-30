<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TokenSettingController extends Controller
{
    /**
     * Get all platform tokens (masked).
     */
    public function getTokens(): JsonResponse
    {
        $keys = [
            'facebook_page_id', 'facebook_access_token',
            'instagram_business_account_id', 'instagram_access_token',
            'wordpress_url', 'wordpress_username', 'wordpress_app_password',
        ];

        $tokens = [];
        foreach ($keys as $key) {
            $val = SystemSetting::where('key', $key)->value('value');
            $tokens[$key] = $val ?? '';
        }

        // Also return last updated timestamp
        $lastUpdated = SystemSetting::where('key', 'tokens_last_updated')->value('value') ?? 'Never';

        return response()->json([
            'tokens' => $tokens,
            'last_updated' => $lastUpdated,
        ]);
    }

    /**
     * Update platform tokens.
     */
    public function updateTokens(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'facebook_page_id' => 'nullable|string',
            'facebook_access_token' => 'nullable|string',
            'instagram_business_account_id' => 'nullable|string',
            'instagram_access_token' => 'nullable|string',
            'wordpress_url' => 'nullable|string',
            'wordpress_username' => 'nullable|string',
            'wordpress_app_password' => 'nullable|string',
        ]);

        foreach ($validated as $key => $value) {
            if ($value !== null) {
                SystemSetting::updateOrCreate(
                    ['key' => $key],
                    [
                        'value' => $value,
                        'type' => 'string',
                        'description' => $this->getLabel($key),
                        'is_public' => false,
                    ]
                );
            }
        }

        // Update timestamp
        SystemSetting::updateOrCreate(
            ['key' => 'tokens_last_updated'],
            [
                'value' => now()->toDateTimeString(),
                'type' => 'string',
                'description' => 'Last time tokens were updated',
                'is_public' => false,
            ]
        );

        return response()->json([
            'message' => 'Tokens updated successfully.',
            'last_updated' => now()->toDateTimeString(),
        ]);
    }

    private function getLabel(string $key): string
    {
        return match ($key) {
            'facebook_page_id' => 'Facebook Page ID',
            'facebook_access_token' => 'Facebook Access Token',
            'instagram_business_account_id' => 'Instagram Business Account ID',
            'instagram_access_token' => 'Instagram Access Token',
            'wordpress_url' => 'WordPress Site URL',
            'wordpress_username' => 'WordPress Username',
            'wordpress_app_password' => 'WordPress Application Password',
            default => $key,
        };
    }
}
