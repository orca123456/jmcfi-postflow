<?php

namespace App\Services;

use App\Models\PostMedia;
use App\Models\PostRequest;
use App\Models\SystemSetting;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class WordPressPublishingService
{
    public function publishPost(PostRequest $post, ?PostMedia $media = null): array
    {
        $settings = SystemSetting::whereIn('key', [
            'wordpress_url', 'wordpress_username', 'wordpress_app_password',
        ])->pluck('value', 'key');
        $url = rtrim(trim((string) ($settings['wordpress_url'] ?? '')), '/');
        $username = trim((string) ($settings['wordpress_username'] ?? ''));
        $password = trim((string) ($settings['wordpress_app_password'] ?? ''));
        if ($username === '' || $password === '') {
            throw new RuntimeException('Save valid WordPress credentials in Platform Tokens before publishing.');
        }
        $client = $this->client($url, $username, $password);
        $endpoint = $url . '/?rest_route=/wp/v2/posts';
        // Recover a successful remote publish if its response was lost before local recording.
        $slug = 'postflow-' . $post->id . '-' . substr(hash('sha256', config('app.url') . '|' . $post->created_at), 0, 12);
        $existing = $this->response($client->get($endpoint . '&slug=' . $slug . '&context=edit'), 'check existing articles');
        foreach ($existing as $article) {
            if (is_array($article) && ($article['slug'] ?? null) === $slug && ($article['status'] ?? null) === 'publish') {
                return $this->publishedArticle($article);
            }
        }

        $payload = [
            'title' => $post->title,
            'content' => $post->caption_narrative ?? '',
            'status' => 'publish',
            'slug' => $slug,
        ];
        if ($media) {
            [$stream, $filename] = $this->openMediaStream($media);
            try {
                $upload = $this->response((clone $client)
                    ->attach('file', $stream, $filename)
                    ->post($url . '/?rest_route=/wp/v2/media'), 'upload image');
            } finally {
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }
            if (empty($upload['id']) || !is_numeric($upload['id'])) {
                throw new RuntimeException('WordPress did not return an uploaded image ID.');
            }
            $payload['featured_media'] = (int) $upload['id'];
        }

        return $this->publishedArticle($this->response($client->post($endpoint, $payload), 'publish article'));
    }

    private function openMediaStream(PostMedia $media): array
    {
        $path = str_replace('\\', '/', (string) $media->file_path);
        $diskName = config('filesystems.default');
        $mediaUrl = (string) ($media->url ?? '');

        if (in_array($diskName, ['s3', 'b2'], true) && filter_var($mediaUrl, FILTER_VALIDATE_URL)) {
            return $this->openMediaUrlStream($mediaUrl);
        }

        if ($path !== '') {
            $disk = Storage::disk(in_array($diskName, ['s3', 'b2'], true) ? $diskName : 'public');
            if (!$disk->exists($path)) {
                throw new RuntimeException('WordPress image is missing from storage. Re-upload the image before publishing.');
            }
            $stream = $disk->readStream($path);
            if (!is_resource($stream)) {
                throw new RuntimeException('Unable to read the WordPress image from storage.');
            }

            return [$stream, basename($path)];
        }

        if (!filter_var($mediaUrl, FILTER_VALIDATE_URL)) {
            throw new RuntimeException('WordPress image is missing from storage. Re-upload the image before publishing.');
        }

        return $this->openMediaUrlStream($mediaUrl);
    }

    private function openMediaUrlStream(string $mediaUrl): array
    {
        $response = Http::connectTimeout(5)->timeout(25)->withoutRedirecting()->get($mediaUrl);
        if (!$response->successful()) {
            throw new RuntimeException("WordPress image could not be downloaded (HTTP {$response->status()}). Re-upload the image before publishing.");
        }

        $stream = fopen('php://temp', 'r+');
        if (!is_resource($stream)) {
            throw new RuntimeException('Unable to prepare the WordPress image for upload.');
        }
        fwrite($stream, $response->body());
        rewind($stream);

        return [$stream, basename(parse_url($mediaUrl, PHP_URL_PATH) ?: 'postflow-image.jpg') ?: 'postflow-image.jpg'];
    }

    private function client(string $url, string $username, string $password): PendingRequest
    {
        $parts = parse_url($url);
        if (!filter_var($url, FILTER_VALIDATE_URL) || ($parts['scheme'] ?? '') !== 'https'
            || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])
            || (isset($parts['port']) && $parts['port'] !== 443)) {
            throw new RuntimeException('Save a valid HTTPS WordPress site URL in Platform Tokens.');
        }
        $host = $parts['host'];
        $addresses = gethostbynamel($host) ?: [];
        if (!$addresses || array_filter($addresses, fn ($ip) => !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE))) {
            throw new RuntimeException('WordPress must use a publicly accessible website address.');
        }

        return Http::withBasicAuth($username, $password)->acceptJson()
            ->connectTimeout(5)->timeout(25)->withoutRedirecting()
            ->withOptions(['curl' => [CURLOPT_RESOLVE => ["{$host}:443:{$addresses[0]}"]]]);
    }

    private function response(Response $response, string $operation): array
    {
        if (!$response->successful() || !is_array($response->json())) {
            throw new RuntimeException("WordPress could not {$operation} (HTTP {$response->status()}). Check the saved credentials, publishing permissions, and REST API availability.");
        }

        return $response->json();
    }

    private function publishedArticle(array $article): array
    {
        if (empty($article['id']) || !is_numeric($article['id']) || ($article['status'] ?? '') !== 'publish' || empty($article['link'])) {
            throw new RuntimeException('WordPress did not confirm a published article and URL. Check WordPress Posts before retrying.');
        }

        return $article;
    }
}
