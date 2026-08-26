<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use App\Services\AuditLogService;
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
        $keys = [
            'facebook_page_id', 'facebook_access_token',
            'instagram_business_account_id', 'instagram_access_token',
            'wordpress_url', 'wordpress_username', 'wordpress_app_password',
        ];

        $validated = $request->validate([
            'facebook_page_id' => 'nullable|string',
            'facebook_access_token' => 'nullable|string',
            'instagram_business_account_id' => 'nullable|string',
            'instagram_access_token' => 'nullable|string',
            'wordpress_url' => 'nullable|string',
            'wordpress_username' => 'nullable|string',
            'wordpress_app_password' => 'nullable|string',
        ]);

        foreach ($keys as $key) {
            if (!$request->exists($key)) {
                continue;
            }

            $value = $validated[$key] ?? '';
            $value = is_string($value) ? trim($value) : '';

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

        if ($request->exists('facebook_page_id') || $request->exists('facebook_access_token')) {
            Cache::forget('facebook_page_id');
            Cache::forget('facebook_access_token');
        }

        if ($request->exists('instagram_business_account_id') || $request->exists('instagram_access_token')) {
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

        AuditLogService::log('TOKEN_SETTINGS_UPDATED', 'Updated platform token settings', 'WARNING', [
            'fields' => array_values(array_filter($keys, fn ($key) => $request->exists($key))),
        ], $request);

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

        $pageId = $this->requestValueOrSetting($request, $validated, 'facebook_page_id');
        $facebookToken = $this->requestValueOrSetting($request, $validated, 'facebook_access_token');
        $instagramId = $this->requestValueOrSetting($request, $validated, 'instagram_business_account_id');
        $instagramToken = $request->exists('instagram_access_token')
            ? trim((string) ($validated['instagram_access_token'] ?? ''))
            : (SystemSetting::where('key', 'instagram_access_token')->value('value') ?: $facebookToken);

        $version = env('FACEBOOK_GRAPH_API_VERSION', 'v26.0');
        $checks = [
            'facebook' => ['valid' => false],
            'instagram' => ['valid' => false],
        ];
        $derived = [];

        if ($pageId && $facebookToken) {
            $response = Http::get("https://graph.facebook.com/{$version}/{$pageId}", [
                'fields' => 'id,name,can_post,access_token,instagram_business_account',
                'access_token' => $facebookToken,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $pageAccessToken = data_get($data, 'access_token');
                if ($pageAccessToken && $pageAccessToken !== $facebookToken) {
                    $derived['facebook_access_token'] = $pageAccessToken;
                    $facebookToken = $pageAccessToken;
                    $instagramToken = $request->exists('instagram_access_token') && trim((string) ($validated['instagram_access_token'] ?? '')) !== trim((string) ($validated['facebook_access_token'] ?? ''))
                        ? $instagramToken
                        : $pageAccessToken;

                    $pageTokenResponse = Http::get("https://graph.facebook.com/{$version}/{$pageId}", [
                        'fields' => 'id,name,can_post,instagram_business_account',
                        'access_token' => $pageAccessToken,
                    ]);

                    if ($pageTokenResponse->successful()) {
                        $data = array_merge($data, $pageTokenResponse->json());
                    }
                }

                $canPost = (bool) data_get($data, 'can_post', true);
                $checks['facebook'] = [
                    'valid' => $canPost,
                    'id' => $data['id'] ?? null,
                    'name' => $data['name'] ?? null,
                    'can_post' => $canPost,
                    'instagram_business_account_id' => data_get($data, 'instagram_business_account.id'),
                ];

                if (data_get($data, 'instagram_business_account.id')) {
                    $derived['instagram_business_account_id'] = data_get($data, 'instagram_business_account.id');
                }

                if (!$canPost) {
                    $checks['facebook']['error'] = 'This token can view the Page but cannot publish to it. Use Save & Validate again so PostFlow can save the derived Page Access Token, or generate the token with a Facebook account that has Page content access.';
                }
            } else {
                $checks['facebook']['error'] = $this->friendlyMetaError($response->json(), $response->body());
            }

            $permissionCheck = $this->checkMetaPermissions($facebookToken, [
                'pages_show_list',
                'pages_read_engagement',
                'pages_manage_posts',
            ]);

            $checks['facebook']['permissions'] = $permissionCheck['granted'];
            $checks['facebook']['missing_permissions'] = $permissionCheck['missing'];

            if ($permissionCheck['missing'] !== []) {
                $checks['facebook']['valid'] = false;
                $checks['facebook']['error'] = 'Missing Facebook publishing permission(s): '
                    . implode(', ', $permissionCheck['missing'])
                    . '. Regenerate the Page Access Token with these permissions selected.';
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

            $permissionCheck = $this->checkMetaPermissions($instagramToken, [
                'instagram_basic',
                'instagram_content_publish',
            ]);

            $checks['instagram']['permissions'] = $permissionCheck['granted'];
            $checks['instagram']['missing_permissions'] = $permissionCheck['missing'];

            if ($permissionCheck['missing'] !== []) {
                $checks['instagram']['valid'] = false;
                $checks['instagram']['error'] = 'Missing Instagram publishing permission(s): '
                    . implode(', ', $permissionCheck['missing'])
                    . '. Regenerate the Page Access Token with these permissions selected.';
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

    private function requestValueOrSetting(Request $request, array $validated, string $key): string
    {
        if ($request->exists($key)) {
            return trim((string) ($validated[$key] ?? ''));
        }

        return (string) (SystemSetting::where('key', $key)->value('value') ?? '');
    }

    private function checkMetaPermissions(string $accessToken, array $required): array
    {
        $version = env('FACEBOOK_GRAPH_API_VERSION', 'v26.0');
        $response = Http::get("https://graph.facebook.com/{$version}/me/permissions", [
            'access_token' => $accessToken,
        ]);

        if (!$response->successful()) {
            $message = strtolower((string) data_get($response->json(), 'error.message', ''));
            if (str_contains($message, 'permissions')) {
                return [
                    'granted' => $required,
                    'missing' => [],
                ];
            }

            return [
                'granted' => [],
                'missing' => $required,
            ];
        }

        $granted = collect($response->json('data', []))
            ->filter(fn ($permission) => ($permission['status'] ?? null) === 'granted')
            ->pluck('permission')
            ->values()
            ->all();

        return [
            'granted' => $granted,
            'missing' => array_values(array_diff($required, $granted)),
        ];
    }
}
