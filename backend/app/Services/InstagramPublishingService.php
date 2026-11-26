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
        $this->graphApiVersion = env('FACEBOOK_GRAPH_API_VERSION', 'v26.0');
    }

    /**
     * Publish a post or carousel to Instagram.
     * 
     * @param string $caption
     * @param string|array|null $imageUrl Single image URL or array of image URLs
     */
    public function publishPost(string $caption, string|array|null $imageUrl): array
    {
        if (empty($this->businessAccountId) || empty($this->accessToken)) {
            throw new Exception('Instagram credentials are not configured.');
        }

        $urls = is_array($imageUrl) ? array_values(array_filter($imageUrl)) : ($imageUrl ? [$imageUrl] : []);

        if (empty($urls)) {
            throw new Exception('Instagram publishing requires a publicly accessible image URL.');
        }

        $cleanCaption = str_ireplace(['<br>', '<br/>', '<br />', '</p>'], "\n", $caption);
        $cleanCaption = html_entity_decode(strip_tags($cleanCaption), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $cleanCaption = trim($cleanCaption);

        if (count($urls) > 1) {
            // Instagram carousels support between 2 and 10 items
            $carouselUrls = array_slice($urls, 0, 10);
            return $this->publishCarousel($cleanCaption, $carouselUrls);
        }

        return $this->publishSingleImage($cleanCaption, $urls[0]);
    }

    protected function publishSingleImage(string $cleanCaption, string $imageUrl): array
    {
        if (!filter_var($imageUrl, FILTER_VALIDATE_URL)) {
            throw new Exception('Instagram publishing requires a publicly accessible image URL.');
        }

        $containerEndpoint = "https://graph.facebook.com/{$this->graphApiVersion}/{$this->businessAccountId}/media";

        $containerResponse = Http::withoutVerifying()->asForm()->post($containerEndpoint, [
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

        $this->pollContainerStatus($creationId);

        return $this->publishContainer($creationId);
    }

    /**
     * Publish a carousel of 2-10 items to Instagram.
     */
    protected function publishCarousel(string $cleanCaption, array $imageUrls): array
    {
        $itemContainerIds = [];
        $containerEndpoint = "https://graph.facebook.com/{$this->graphApiVersion}/{$this->businessAccountId}/media";

        // Step 1: Create a container for each image item with is_carousel_item = true
        foreach ($imageUrls as $index => $imageUrl) {
            if (!filter_var($imageUrl, FILTER_VALIDATE_URL)) {
                Log::warning("Instagram carousel: Invalid image URL at index {$index}: {$imageUrl}. Skipping.");
                continue;
            }

            $response = Http::withoutVerifying()->asForm()->post($containerEndpoint, [
                'image_url' => $imageUrl,
                'is_carousel_item' => 'true',
                'access_token' => $this->accessToken,
            ]);

            if (!$response->successful() || empty($response->json('id'))) {
                Log::error("Instagram carousel item #{$index} container creation failed.", [
                    'status' => $response->status(),
                    'error' => $response->json(),
                ]);
                throw new Exception("Instagram API Error creating carousel item: " . $response->body());
            }

            $itemContainerIds[] = (string) $response->json('id');
        }

        if (count($itemContainerIds) < 2) {
            if (count($itemContainerIds) === 1) {
                return $this->publishSingleImage($cleanCaption, $imageUrls[0]);
            }
            throw new Exception('Instagram carousel requires at least 2 valid image URLs.');
        }

        // Step 2: Poll each item container until FINISHED
        foreach ($itemContainerIds as $itemId) {
            $this->pollContainerStatus($itemId);
        }

        // Step 3: Create parent CAROUSEL container
        $carouselResponse = Http::withoutVerifying()->asForm()->post($containerEndpoint, [
            'media_type' => 'CAROUSEL',
            'caption' => $cleanCaption,
            'children' => implode(',', $itemContainerIds),
            'access_token' => $this->accessToken,
        ]);

        if (!$carouselResponse->successful() || empty($carouselResponse->json('id'))) {
            Log::error('Instagram carousel parent container creation failed.', [
                'status' => $carouselResponse->status(),
                'error' => $carouselResponse->json(),
            ]);
            throw new Exception('Instagram API Error creating carousel container: ' . $carouselResponse->body());
        }

        $carouselCreationId = (string) $carouselResponse->json('id');

        // Step 4: Poll parent carousel container status until FINISHED
        $this->pollContainerStatus($carouselCreationId);

        // Step 5: Publish carousel
        return $this->publishContainer($carouselCreationId);
    }

    /**
     * Poll container status until FINISHED.
     */
    protected function pollContainerStatus(string $creationId, int $maxAttempts = 15): void
    {
        $statusEndpoint = "https://graph.facebook.com/{$this->graphApiVersion}/{$creationId}";
        $isReady = false;

        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            sleep(2);

            $statusResponse = Http::withoutVerifying()->get($statusEndpoint, [
                'fields' => 'status_code,status',
                'access_token' => $this->accessToken,
            ]);

            if ($statusResponse->successful()) {
                $statusCode = strtoupper((string) ($statusResponse->json('status_code') ?? ''));
                Log::info("Instagram media container status check (attempt {$attempt}/{$maxAttempts}): {$statusCode}", [
                    'creation_id' => $creationId,
                    'status_data' => $statusResponse->json(),
                ]);

                if ($statusCode === 'FINISHED') {
                    $isReady = true;
                    break;
                }

                if ($statusCode === 'ERROR') {
                    $errorMsg = $statusResponse->json('status') ?? 'Instagram media processing encountered an error.';
                    throw new Exception("Instagram API container processing failed: {$errorMsg}");
                }

                if ($statusCode === 'EXPIRED') {
                    throw new Exception("Instagram media container expired before publishing.");
                }
            } else {
                Log::warning("Instagram media container status check failed (attempt {$attempt}/{$maxAttempts})", [
                    'creation_id' => $creationId,
                    'response' => $statusResponse->body(),
                ]);
            }
        }

        if (!$isReady) {
            throw new Exception("Instagram media container is not ready after {$maxAttempts} attempts. The media may still be processing.");
        }
    }

    /**
     * Publish the ready container.
     */
    protected function publishContainer(string $creationId): array
    {
        $publishEndpoint = "https://graph.facebook.com/{$this->graphApiVersion}/{$this->businessAccountId}/media_publish";

        $publishResponse = Http::withoutVerifying()->asForm()->post($publishEndpoint, [
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
