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
        $this->pageId = env('FACEBOOK_PAGE_ID', '');
        $this->accessToken = env('FACEBOOK_PAGE_ACCESS_TOKEN', '');
        $this->graphApiVersion = env('FACEBOOK_GRAPH_API_VERSION', 'v19.0');
    }

    /**
     * Publish a post to the Facebook Page.
     * 
     * @param string $message The content of the post
     * @param string|null $mediaUrl Optional URL to a media file (image)
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

        $endpoint = $mediaPath 
            ? "https://graph.facebook.com/{$this->graphApiVersion}/{$this->pageId}/photos"
            : "https://graph.facebook.com/{$this->graphApiVersion}/{$this->pageId}/feed";

        $payload = [
            'access_token' => $this->accessToken,
            'message' => $message,
        ];

        try {
            if ($mediaPath && file_exists($mediaPath)) {
                $response = Http::withoutVerifying()
                    ->attach('source', file_get_contents($mediaPath), basename($mediaPath))
                    ->post($endpoint, $payload);
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
