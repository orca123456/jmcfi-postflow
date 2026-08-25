<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

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

        if (array_key_exists('facebook_page_id', $validated) || array_key_exists('facebook_access_token', $validated)) {
            Cache::forget('facebook_page_id');
            Cache::forget('facebook_access_token');
        }

        if (array_key_exists('instagram_business_account_id', $validated) || array_key_exists('instagram_access_token', $validated)) {
            Cache::forget('instagram_business_account_id');
            Cache::forget('instagram_access_token');
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

    public function validateTokens(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'facebook_page_id' => 'nullable|string',
            'facebook_access_token' => 'nullable|string',
            'instagram_business_account_id' => 'nullable|string',
            'instagram_access_token' => 'nullable|string',
        ]);

        $pageId = $validated['facebook_page_id']
            ?? SystemSetting::where('key', 'facebook_page_id')->value('value')
            ?? '';
        $facebookToken = $validated['facebook_access_token']
            ?? SystemSetting::where('key', 'facebook_access_token')->value('value')
            ?? '';
        $instagramId = $validated['instagram_business_account_id']
            ?? SystemSetting::where('key', 'instagram_business_account_id')->value('value')
            ?? '';
        $instagramToken = $validated['instagram_access_token']
            ?? $facebookToken
            ?? SystemSetting::where('key', 'instagram_access_token')->value('value')
            ?? '';

        $version = env('FACEBOOK_GRAPH_API_VERSION', 'v26.0');
        $checks = [
            'facebook' => ['valid' => false],
            'instagram' => ['valid' => false],
        ];
        $derived = [];

        if ($pageId && $facebookToken) {
            $response = Http::get("https://graph.facebook.com/{$version}/{$pageId}", [
                'fields' => 'id,name,instagram_business_account',
                'access_token' => $facebookToken,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $checks['facebook'] = [
                    'valid' => true,
                    'id' => $data['id'] ?? null,
                    'name' => $data['name'] ?? null,
                    'instagram_business_account_id' => data_get($data, 'instagram_business_account.id'),
                ];

                if (data_get($data, 'instagram_business_account.id')) {
                    $derived['instagram_business_account_id'] = data_get($data, 'instagram_business_account.id');
                }
            } else {
                $checks['facebook']['error'] = $this->friendlyMetaError($response->json(), $response->body());
            }
        } else {
            $checks['facebook']['error'] = 'Facebook Page ID and Page Access Token are required.';
        }

        $instagramId = $derived['instagram_business_account_id'] ?? $instagramId;
        if ($instagramId && $instagramToken) {
            $response = Http::get("https://graph.facebook.com/{$version}/{$instagramId}", [
                'fields' => 'id,username',
                'access_token' => $instagramToken,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $checks['instagram'] = [
                    'valid' => true,
                    'id' => $data['id'] ?? null,
                    'username' => $data['username'] ?? null,
                ];
            } else {
                $checks['instagram']['error'] = $this->friendlyMetaError($response->json(), $response->body());
            }
        } else {
            $checks['instagram']['error'] = 'Instagram Business Account ID and Page Access Token are required.';
        }

        return response()->json([
            'valid' => $checks['facebook']['valid'] && $checks['instagram']['valid'],
            'checks' => $checks,
            'derived' => $derived,
            'required_permissions' => [
                'Facebook publishing' => ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
                'Instagram publishing' => ['instagram_basic', 'instagram_content_publish'],
            ],
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

    private function friendlyMetaError(?array $json, string $body): string
    {
        $message = data_get($json, 'error.message', $body);
        $code = data_get($json, 'error.code');
        $subcode = data_get($json, 'error.error_subcode');

        if ($code === 190) {
            return 'The Meta access token is invalid or expired. Generate a fresh Page Access Token and save it here.';
        }

        if ($code === 200 || str_contains(strtolower((string) $message), 'publish_actions')) {
            return 'The token is missing the Page publishing permission. Regenerate it with pages_manage_posts, pages_read_engagement, pages_show_list, instagram_basic, and instagram_content_publish.';
        }

        return trim($message . ($subcode ? " (subcode {$subcode})" : ''));
    }
}
