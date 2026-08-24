<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Exception;

class FacebookPublishingService
{
    protected string $pageId;
    protected string $accessToken;
    protected string $graphApiVersion;

    public function __construct()
    {
        $this->pageId = \Illuminate\Support\Facades\Cache::remember('facebook_page_id', 3600, function () {
            return \App\Models\SystemSetting::where('key', 'facebook_page_id')->value('value') ?? env('FACEBOOK_PAGE_ID', '');
        });
        $this->accessToken = \Illuminate\Support\Facades\Cache::remember('facebook_access_token', 3600, function () {
            return \App\Models\SystemSetting::where('key', 'facebook_access_token')->value('value') ?? env('FACEBOOK_PAGE_ACCESS_TOKEN', '');
        });
        $this->graphApiVersion = env('FACEBOOK_GRAPH_API_VERSION', 'v19.0');
    }

    /**
     * Publish a post to the Facebook Page.
     * 
     * @param string $message The content of the post
     * @param string|null $mediaPath Optional URL to a media file (image)
     * @return array|null Returns the API response containing the post ID if successful
     * @throws Exception
     */
    public function publishPost(string $message, ?string $mediaPath = null): ?array
    {
        if (empty($this->pageId) || empty($this->accessToken)) {
            Log::warning('Facebook API credentials not configured. Skipping real publish.');
            // Fallback for testing: return a mock ID if credentials are not present.
            return ['id' => 'mock_fb_post_12345'];
        }

        $isUrl = $mediaPath ? filter_var($mediaPath, FILTER_VALIDATE_URL) : false;

        if ($mediaPath && !$isUrl && !file_exists($mediaPath)) {
            throw new Exception("Media file not found on the server. If the server restarted, uploaded files may have been lost. Please re-upload the image.");
        }

        $endpoint = $mediaPath 
            ? "https://graph.facebook.com/{$this->graphApiVersion}/{$this->pageId}/photos"
            : "https://graph.facebook.com/{$this->graphApiVersion}/{$this->pageId}/feed";

        // Strip HTML tags before publishing, as Facebook does not support them
        $cleanMessage = str_ireplace(['<br>', '<br/>', '<br />', '</p>'], "\n", $message);
        $cleanMessage = html_entity_decode(strip_tags($cleanMessage), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $cleanMessage = trim($cleanMessage);

        $payload = ['access_token' => $this->accessToken];
        $payload[$mediaPath ? 'caption' : 'message'] = $cleanMessage;

        try {
            if ($mediaPath) {
                if ($isUrl) {
                    $payload['url'] = $mediaPath;
                    $response = Http::withoutVerifying()->post($endpoint, $payload);
                } else {
                    $response = Http::withoutVerifying()
                        ->attach('source', file_get_contents($mediaPath), basename($mediaPath))
                        ->post($endpoint, $payload);
                }
            } else {
                $response = Http::withoutVerifying()->post($endpoint, $payload);
            }

            if ($response->successful()) {
                Log::info('Successfully published to Facebook Page.', ['response' => $response->json()]);
                return $response->json();
            } else {
                Log::error('Facebook Graph API error.', [
                    'status' => $response->status(),
                    'error' => $response->json()
                ]);
                throw new Exception("Facebook API Error: " . $response->body());
            }
        } catch (Exception $e) {
            Log::error('Exception while publishing to Facebook: ' . $e->getMessage());
            throw $e;
        }
    }
}
