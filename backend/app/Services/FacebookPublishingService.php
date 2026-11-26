<?php

namespace App\Services;

use App\Models\SystemSetting;
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
        $pageId = SystemSetting::where('key', 'facebook_page_id')->first();
        $accessToken = SystemSetting::where('key', 'facebook_access_token')->first();

        $this->pageId = $pageId ? (string) $pageId->value : env('FACEBOOK_PAGE_ID', '');
        $this->accessToken = $accessToken ? (string) $accessToken->value : env('FACEBOOK_PAGE_ACCESS_TOKEN', '');
        $this->graphApiVersion = env('FACEBOOK_GRAPH_API_VERSION', 'v26.0');
    }

    /**
     * Publish a post to the Facebook Page.
     * 
     * @param string $message The content of the post
     * @param string|array|null $mediaPaths Optional single URL/path or array of URLs/paths for multi-photo album
     * @return array|null Returns the API response containing the post ID if successful
     * @throws Exception
     */
    public function publishPost(string $message, string|array|null $mediaPaths = null): ?array
    {
        if (empty($this->pageId) || empty($this->accessToken)) {
            throw new Exception('Facebook credentials are not configured. Save a valid Page ID and Page Access Token in IT Admin Dashboard.');
        }

        // Strip HTML tags before publishing, as Facebook does not support them
        $cleanMessage = str_ireplace(['<br>', '<br/>', '<br />', '</p>'], "\n", $message);
        $cleanMessage = html_entity_decode(strip_tags($cleanMessage), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $cleanMessage = trim($cleanMessage);

        $paths = is_array($mediaPaths) ? array_values(array_filter($mediaPaths)) : ($mediaPaths ? [$mediaPaths] : []);

        if (count($paths) > 1) {
            return $this->publishMultiPhotoPost($cleanMessage, $paths);
        }

        $singlePath = $paths[0] ?? null;
        return $this->publishSinglePhotoOrTextPost($cleanMessage, $singlePath);
    }

    /**
     * Publish a multi-photo post (album) to Facebook Page feed.
     * Each photo is uploaded with published=false, then attached to a single feed post.
     */
    protected function publishMultiPhotoPost(string $cleanMessage, array $mediaPaths): array
    {
        $attachedMedia = [];
        $uploadEndpoint = "https://graph.facebook.com/{$this->graphApiVersion}/{$this->pageId}/photos";

        foreach ($mediaPaths as $index => $path) {
            $isUrl = filter_var($path, FILTER_VALIDATE_URL);

            if (!$isUrl && !file_exists($path)) {
                Log::warning("Facebook multi-photo upload: media file not found at '{$path}'. Skipping this item.");
                continue;
            }

            try {
                if ($isUrl) {
                    $response = Http::withoutVerifying()
                        ->asForm()
                        ->timeout(45)
                        ->post($uploadEndpoint, [
                            'access_token' => $this->accessToken,
                            'published' => 'false',
                            'url' => $path,
                        ]);
                } else {
                    $response = Http::withoutVerifying()
                        ->timeout(60)
                        ->attach('source', file_get_contents($path), basename($path))
                        ->post($uploadEndpoint, [
                            'access_token' => $this->accessToken,
                            'published' => 'false',
                        ]);
                }

                if ($response->successful() && !empty($response->json('id'))) {
                    $photoId = (string) $response->json('id');
                    $attachedMedia[] = ['media_fbid' => $photoId];
                    Log::info("Facebook uploaded unpublished photo #{$index}: {$photoId}");
                } else {
                    Log::error("Facebook failed to upload unpublished photo #{$index}", [
                        'status' => $response->status(),
                        'response' => $response->json(),
                    ]);
                }
            } catch (\Throwable $e) {
                Log::error("Exception uploading unpublished photo #{$index} to Facebook: " . $e->getMessage());
            }
        }

        if (empty($attachedMedia)) {
            Log::warning("Facebook: No photos were successfully uploaded for multi-photo post. Falling back to text-only post.");
            return $this->publishSinglePhotoOrTextPost($cleanMessage, null);
        }

        $feedEndpoint = "https://graph.facebook.com/{$this->graphApiVersion}/{$this->pageId}/feed";

        // In Meta Graph API, attached_media can be passed either as indexed form fields
        // attached_media[0]={"media_fbid":"..."} or as a JSON array of objects.
        $formPayload = [
            'access_token' => $this->accessToken,
            'message' => $cleanMessage,
            'attached_media' => json_encode($attachedMedia),
        ];
        foreach ($attachedMedia as $i => $item) {
            $formPayload["attached_media[{$i}]"] = is_string($item) ? $item : json_encode($item);
        }

        $response = Http::withoutVerifying()->asForm()->timeout(45)->post($feedEndpoint, $formPayload);

        // Fallback attempt: pass raw array directly in JSON payload if form is not accepted
        if (!$response->successful()) {
            $jsonPayload = [
                'access_token' => $this->accessToken,
                'message' => $cleanMessage,
                'attached_media' => $attachedMedia,
            ];
            $response = Http::withoutVerifying()->timeout(45)->post($feedEndpoint, $jsonPayload);
        }

        if ($response->successful()) {
            Log::info('Successfully published multi-photo post to Facebook Page.', ['response' => $response->json()]);
            return $response->json();
        }

        Log::error('Facebook Graph API multi-photo feed error.', [
            'status' => $response->status(),
            'error' => $response->json(),
        ]);
        throw new Exception("Facebook API Error: " . $response->body());
    }

    /**
     * Publish a single photo or text-only post.
     */
    protected function publishSinglePhotoOrTextPost(string $cleanMessage, ?string $mediaPath = null): array
    {
        $isUrl = $mediaPath ? filter_var($mediaPath, FILTER_VALIDATE_URL) : false;

        if ($mediaPath && !$isUrl && !file_exists($mediaPath)) {
            throw new Exception("Media file not found on the server. If the server restarted, uploaded files may have been lost. Please re-upload the image.");
        }

        $endpoint = $mediaPath 
            ? "https://graph.facebook.com/{$this->graphApiVersion}/{$this->pageId}/photos"
            : "https://graph.facebook.com/{$this->graphApiVersion}/{$this->pageId}/feed";

        $payload = ['access_token' => $this->accessToken];
        $payload[$mediaPath ? 'caption' : 'message'] = $cleanMessage;

        try {
            if ($mediaPath) {
                if ($isUrl) {
                    $payload['url'] = $mediaPath;
                    $response = Http::withoutVerifying()->asForm()->timeout(45)->post($endpoint, $payload);
                } else {
                    $response = Http::withoutVerifying()
                        ->timeout(60)
                        ->attach('source', file_get_contents($mediaPath), basename($mediaPath))
                        ->post($endpoint, $payload);
                }
            } else {
                $response = Http::withoutVerifying()->asForm()->timeout(30)->post($endpoint, $payload);
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
        } catch (\Throwable $e) {
            Log::error('Exception while publishing to Facebook: ' . $e->getMessage());
            throw $e;
        }
    }
}
