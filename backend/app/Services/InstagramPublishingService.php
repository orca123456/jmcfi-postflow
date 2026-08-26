<?php

namespace App\Services;

use App\Models\SystemSetting;
use Exception;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class InstagramPublishingService
{
    protected string $businessAccountId;
    protected string $accessToken;
    protected string $graphApiVersion;

    public function __construct()
    {
        $businessAccountId = SystemSetting::where('key', 'instagram_business_account_id')->first();
        $accessToken = SystemSetting::where('key', 'instagram_access_token')->first();

        $this->businessAccountId = $businessAccountId ? (string) $businessAccountId->value : env('INSTAGRAM_BUSINESS_ACCOUNT_ID', '');
        $this->accessToken = $accessToken ? (string) $accessToken->value : env('INSTAGRAM_ACCESS_TOKEN', '');
        $this->graphApiVersion = env('FACEBOOK_GRAPH_API_VERSION', 'v19.0');
    }

    public function publishPost(string $caption, ?string $imageUrl): array
    {
        if (empty($this->businessAccountId) || empty($this->accessToken)) {
            throw new Exception('Instagram credentials are not configured.');
        }

        if (!$imageUrl || !filter_var($imageUrl, FILTER_VALIDATE_URL)) {
            throw new Exception('Instagram publishing requires a publicly accessible image URL.');
        }

        $cleanCaption = str_ireplace(['<br>', '<br/>', '<br />', '</p>'], "\n", $caption);
        $cleanCaption = html_entity_decode(strip_tags($cleanCaption), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $cleanCaption = trim($cleanCaption);

        $containerEndpoint = "https://graph.facebook.com/{$this->graphApiVersion}/{$this->businessAccountId}/media";

        $containerResponse = Http::asForm()->post($containerEndpoint, [
            'image_url' => $imageUrl,
            'caption' => $cleanCaption,
            'access_token' => $this->accessToken,
        ]);

        if (!$containerResponse->successful()) {
            Log::error('Instagram media container error.', [
                'status' => $containerResponse->status(),
                'error' => $containerResponse->json(),
            ]);

            throw new Exception('Instagram API Error: ' . $containerResponse->body());
        }

        $creationId = $containerResponse->json('id');
        if (!$creationId) {
            throw new Exception('Instagram API Error: media container id was not returned.');
        }

        $publishEndpoint = "https://graph.facebook.com/{$this->graphApiVersion}/{$this->businessAccountId}/media_publish";

        $publishResponse = Http::asForm()->post($publishEndpoint, [
            'creation_id' => $creationId,
            'access_token' => $this->accessToken,
        ]);

        if (!$publishResponse->successful()) {
            Log::error('Instagram media publish error.', [
                'status' => $publishResponse->status(),
                'error' => $publishResponse->json(),
            ]);

            throw new Exception('Instagram API Error: ' . $publishResponse->body());
        }

        Log::info('Successfully published to Instagram.', ['response' => $publishResponse->json()]);

        return [
            'container_id' => $creationId,
            'id' => $publishResponse->json('id'),
            'response' => $publishResponse->json(),
        ];
    }
}
