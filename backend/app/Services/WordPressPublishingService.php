<?php

namespace App\Services;

use App\Models\PostMedia;
use App\Models\PostRequest;
use App\Models\SystemSetting;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class WordPressPublishingService
{
    /**
     * Check if WordPress publishing credentials and URL are configured.
     */
    public function isConfigured(): bool
    {
        $settings = SystemSetting::whereIn('key', [
            'wordpress_url', 'wordpress_username', 'wordpress_app_password',
        ])->pluck('value', 'key');

        $url = trim((string) ($settings['wordpress_url'] ?? ''));
        $username = trim((string) ($settings['wordpress_username'] ?? ''));
        $password = trim((string) ($settings['wordpress_app_password'] ?? ''));

        return $url !== '' && $username !== '' && $password !== '';
    }

    public function publishPost(PostRequest $post, ?PostMedia $media = null, $allMedia = null): array
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

        $title = $this->stripEmojis($post->title ?? '');
        $content = $this->stripEmojis($post->caption_narrative ?? '');
        $payload = [
            'title' => $title,
            'content' => $content,
            'status' => 'publish',
            'slug' => $slug,
        ];

        if ($allMedia && count($allMedia) > 0) {
            $images = collect($allMedia)->values();
            $featured = $media ?? $images->first();

            if ($featured) {
                [$stream, $filename] = $this->openMediaStream($featured);
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

            $additionalImagesHtml = '';
            foreach ($images as $img) {
                if ($featured && (int) $img->id === (int) $featured->id) {
                    continue;
                }
                try {
                    [$stream, $filename] = $this->openMediaStream($img);
                    try {
                        $upload = $this->response((clone $client)
                            ->attach('file', $stream, $filename)
                            ->post($url . '/?rest_route=/wp/v2/media'), 'upload additional image');
                    } finally {
                        if (is_resource($stream)) {
                            fclose($stream);
                        }
                    }
                    $imgUrl = $upload['source_url'] ?? data_get($upload, 'guid.rendered');
                    $imgId = (int) ($upload['id'] ?? 0);
                    if ($imgUrl) {
                        $additionalImagesHtml .= sprintf(
                            '<p><figure class="wp-block-image size-large"><img src="%s" alt="%s" class="wp-image-%d"/></figure></p>',
                            htmlspecialchars($imgUrl, ENT_QUOTES, 'UTF-8'),
                            htmlspecialchars($title, ENT_QUOTES, 'UTF-8'),
                            $imgId
                        );
                    }
                } catch (\Throwable $e) {
                    Log::warning("WordPress: Could not upload additional media {$img->id}: {$e->getMessage()}");
                }
            }

            if ($additionalImagesHtml !== '') {
                $payload['content'] = $content . "\n\n" . $additionalImagesHtml;
            }
        } elseif ($media) {
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
        $response = Http::withoutVerifying()->connectTimeout(5)->timeout(25)->withoutRedirecting()->get($mediaUrl);
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

        return Http::withoutVerifying()->withBasicAuth($username, $password)->acceptJson()
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

    /**
     * Remove emojis and non-alphanumeric pictographs from text for WordPress publishing.
     */
    public function stripEmojis(?string $text): string
    {
        if ($text === null || $text === '') {
            return '';
        }

        // Comprehensive emoji ranges in Unicode
        $regex = '/[\x{1F600}-\x{1F64F}\x{1F300}-\x{1F5FF}\x{1F680}-\x{1F6FF}\x{1F1E0}-\x{1F1FF}\x{1F900}-\x{1F9FF}\x{1FA70}-\x{1FAFF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}\x{FE00}-\x{FE0F}\x{1F3FB}-\x{1F3FF}\x{200D}\x{20D0}-\x{20FF}\x{2300}-\x{23FF}\x{2B50}\x{2B55}\x{2934}\x{2935}\x{25AA}\x{25AB}\x{25B6}\x{25C0}\x{25FB}-\x{25FE}]/u';

        $clean = preg_replace($regex, '', $text) ?? $text;

        // Clean up multi-spaces on each line while preserving line breaks
        $clean = preg_replace('/[ \t]{2,}/', ' ', $clean) ?? $clean;
        // Clean up spacing before punctuation left by stripped emojis
        $clean = preg_replace('/[ \t]+([.,!?:;])/', '$1', $clean) ?? $clean;
        // Remove trailing spaces on lines
        $clean = preg_replace('/[ \t]+$/m', '', $clean) ?? $clean;

        return trim($clean);
    }
}
