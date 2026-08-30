<?php

namespace App\Jobs;

use App\Models\PostRequest;
use App\Models\PublishingRecord;
use App\Models\User;
use App\Notifications\PostPublishedSuccessNotification;
use App\Notifications\PostPublishingFailedNotification;
use App\Services\FacebookPublishingService;
use App\Services\InstagramPublishingService;
use Exception;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

class AutoPublishJob implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public array $backoff = [30, 60, 120];
    public int $timeout = 120;
    public int $uniqueFor = 300;

    public function __construct(public PostRequest $postRequest, public ?int $publishedBy = null) {}

    public function uniqueId(): string
    {
        return 'post-publish-' . $this->postRequest->id;
    }

    public function handle(FacebookPublishingService $facebookService, InstagramPublishingService $instagramService): void
    {
        $this->postRequest->refresh();
        Log::info("AutoPublishJob: Starting publish for post ID {$this->postRequest->id} - {$this->postRequest->title}");

        try {
            $platforms = is_string($this->postRequest->target_platforms)
                ? json_decode($this->postRequest->target_platforms, true)
                : $this->postRequest->target_platforms;

            if (!is_array($platforms)) {
                $platforms = [];
            }

            $lowerPlatforms = array_map('strtolower', $platforms);
            $publishResults = [];
            $publishErrors = [];
            $media = $this->postRequest->media()
                ->where(function ($query) {
                    $query->where('type', 'image')
                        ->orWhere('mime_type', 'like', 'image/%');
                })
                ->orderBy('sort_order')
                ->first();

            if ($this->postRequest->status !== PostRequest::STATUS_PUBLISHING) {
                $this->postRequest->update(['status' => PostRequest::STATUS_PUBLISHING]);
            }

            if (in_array('instagram', $lowerPlatforms, true) || in_array('ig', $lowerPlatforms, true)) {
                try {
                    $imageUrl = $media ? route('instagram.media', ['media' => $media->id]) : null;
                    $publishResults['instagram'] = $instagramService->publishPost($this->postRequest->caption_narrative ?? '', $imageUrl);
                    Log::info("AutoPublishJob: Successfully published to Instagram for post ID {$this->postRequest->id}");
                } catch (Exception $e) {
                    $publishErrors['instagram'] = $this->friendlyPublishError($e->getMessage());
                    Log::error('AutoPublishJob: Publish to Instagram failed: ' . $e->getMessage());
                }
            }

            if (in_array('facebook', $lowerPlatforms, true) || in_array('fb', $lowerPlatforms, true)) {
                $mediaPath = null;
                if ($media && $media->file_path) {
                    $disk = config('filesystems.default');
                    if (in_array($disk, ['s3', 'b2'], true)) {
                        $mediaPath = $media->url ?? Storage::disk($disk)->url($media->file_path);
                    } else {
                        $mediaPath = Storage::disk('public')->path($media->file_path);
                    }
                }

                try {
                    $publishResults['facebook'] = $facebookService->publishPost($this->postRequest->caption_narrative ?? '', $mediaPath);
                    Log::info("AutoPublishJob: Successfully published to Facebook for post ID {$this->postRequest->id}");
                } catch (Exception $e) {
                    $publishErrors['facebook'] = $this->friendlyPublishError($e->getMessage());
                    Log::error('AutoPublishJob: Publish to Facebook failed: ' . $e->getMessage());
                }
            }

            $this->recordPublishingResults($publishResults, $publishErrors);

            if ($publishResults === []) {
                $this->postRequest->update(['status' => PostRequest::STATUS_PUBLISH_FAILED]);
                throw new Exception($this->formatPublishErrors($publishErrors));
            }

            $this->postRequest->update([
                'status' => PostRequest::STATUS_PUBLISHED,
                'published_at' => now(),
            ]);

            \App\Services\AuditLogService::log(
                'AUTO_PUBLISHED',
                "Auto-published post \"{$this->postRequest->title}\" to selected platforms.",
                $publishErrors === [] ? 'INFO' : 'WARNING',
                [
                    'postId' => $this->postRequest->id,
                    'platforms' => $platforms,
                    'results' => $publishResults,
                    'errors' => $publishErrors,
                ]
            );

            $this->notifyITAdmins(new PostPublishedSuccessNotification($this->postRequest, $publishResults));
            Log::info("AutoPublishJob: Completed for post ID {$this->postRequest->id}");
        } catch (Exception $e) {
            Log::error("AutoPublishJob: FAILED for post ID {$this->postRequest->id}. Error: {$e->getMessage()}");

            $this->postRequest->update(['status' => PostRequest::STATUS_PUBLISH_FAILED]);
            $this->notifyITAdmins(new PostPublishingFailedNotification($this->postRequest, $e->getMessage()));

            throw $e;
        }
    }

    public function failed(Exception $exception): void
    {
        Log::critical("AutoPublishJob: All retries exhausted for post ID {$this->postRequest->id}. Final error: {$exception->getMessage()}");

        $this->postRequest->update(['status' => PostRequest::STATUS_PUBLISH_FAILED]);

        $this->notifyITAdmins(new PostPublishingFailedNotification(
            $this->postRequest,
            'All automatic retry attempts failed. Manual publishing required. Error: ' . $exception->getMessage()
        ));
    }

    private function recordPublishingResults(array $results, array $errors): void
    {
        foreach ($results as $platform => $response) {
            $this->savePublishingRecord($platform, [
                'external_post_id' => $this->externalPostId($platform, $response),
                'external_url' => $this->externalPostUrl($platform, $response),
                'status' => 'published',
                'published_at' => now(),
                'error_message' => null,
                'platform_response' => $response,
            ]);
        }

        foreach ($errors as $platform => $message) {
            $this->savePublishingRecord($platform, [
                'status' => 'failed',
                'published_at' => now(),
                'error_message' => $message,
            ]);
        }
    }

    private function savePublishingRecord(string $platform, array $attributes): void
    {
        $record = PublishingRecord::query()
            ->where('post_request_id', $this->postRequest->id)
            ->where('platform', $platform)
            ->whereIn('status', ['scheduled', 'publishing'])
            ->latest('id')
            ->first();

        if (! $record) {
            $record = new PublishingRecord([
                'post_request_id' => $this->postRequest->id,
                'platform' => $platform,
            ]);
        }

        $record->fill(array_merge([
            'published_by' => $this->publishedBy ?? $this->fallbackPublisherId(),
        ], $attributes));
        $record->save();
    }

    private function fallbackPublisherId(): int
    {
        return (int) User::whereHas('roles', fn ($query) => $query->whereIn('name', ['it_publisher', 'it_admin', 'admin']))
            ->where('status', 'active')
            ->value('id');
    }

    private function externalPostId(string $platform, array $response): ?string
    {
        return match ($platform) {
            'instagram' => $response['id'] ?? data_get($response, 'response.id'),
            'facebook' => $response['post_id'] ?? $response['id'] ?? null,
            default => $response['id'] ?? null,
        };
    }

    private function externalPostUrl(string $platform, array $response): ?string
    {
        if (!empty($response['permalink'])) {
            return $response['permalink'];
        }

        $id = $this->externalPostId($platform, $response);
        if (!$id) {
            return null;
        }

        return match ($platform) {
            'facebook' => str_contains($id, '_') ? 'https://www.facebook.com/' . str_replace('_', '/posts/', $id) : null,
            default => null,
        };
    }

    private function formatPublishErrors(array $errors): string
    {
        if ($errors === []) {
            return 'No platform was selected or no platform returned a successful response.';
        }

        return collect($errors)
            ->map(fn ($message, $platform) => ucfirst((string) $platform) . ': ' . $message)
            ->implode(' ');
    }

    private function friendlyPublishError(string $message): string
    {
        $jsonStart = strpos($message, '{');
        $decoded = json_decode($jsonStart === false ? $message : substr($message, $jsonStart), true);
        $metaMessage = data_get($decoded, 'error.message', $message);
        $code = data_get($decoded, 'error.code');

        if ($code === 190 || str_contains(strtolower($metaMessage), 'access token')) {
            return 'The saved Meta token is invalid or expired. Open Platform Tokens, paste a fresh Page Access Token, then click Save & Validate Publishing Setup.';
        }

        if ($code === 200 || str_contains(strtolower($metaMessage), 'publish_actions')) {
            return 'The Page token is missing pages_manage_posts. Regenerate the Meta token with pages_manage_posts, pages_read_engagement, pages_show_list, instagram_basic, and instagram_content_publish, then save it in Platform Tokens.';
        }

        return $metaMessage;
    }

    private function notifyITAdmins(object $notification): void
    {
        try {
            $itAdmins = User::whereHas('roles', fn ($query) => $query->whereIn('name', ['it_publisher', 'it_admin', 'admin']))
                ->where('status', 'active')
                ->get();

            if ($itAdmins->isNotEmpty()) {
                Notification::send($itAdmins, $notification);
            }
        } catch (Exception $e) {
            Log::error('AutoPublishJob: Failed to send admin notification. Error: ' . $e->getMessage());
        }
    }
}
