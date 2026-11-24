<?php

namespace App\Jobs;

use App\Models\PostRequest;
use App\Models\PublishingRecord;
use App\Models\User;
use App\Notifications\PostPublishedRequestorNotification;
use App\Notifications\PostPublishedSuccessNotification;
use App\Notifications\PostPublishingFailedNotification;
use App\Services\FacebookPublishingService;
use App\Services\InstagramPublishingService;
use App\Services\WordPressPublishingService;
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

    public int $tries = 1;

    public int $timeout = 120;
    public int $uniqueFor = 300;

    public function __construct(public PostRequest $postRequest, public ?int $publishedBy = null) {}

    public function uniqueId(): string
    {
        return 'post-publish-' . $this->postRequest->id;
    }

    public function handle(FacebookPublishingService $facebookService, InstagramPublishingService $instagramService, WordPressPublishingService $wordpressService): void
    {
        $this->postRequest->refresh();
        Log::info("AutoPublishJob: Starting publish for post ID {$this->postRequest->id} - {$this->postRequest->title}");

        if ($this->postRequest->status === PostRequest::STATUS_PUBLISHED) {
            Log::info("AutoPublishJob: Post ID {$this->postRequest->id} is already published. Skipping.");
            return;
        }

        if (
            $this->postRequest->status === PostRequest::STATUS_SCHEDULED &&
            $this->postRequest->preferred_schedule_at &&
            \Carbon\Carbon::parse($this->postRequest->preferred_schedule_at)->isFuture()
        ) {
            Log::info("AutoPublishJob: Post ID {$this->postRequest->id} scheduled time is in the future ({$this->postRequest->preferred_schedule_at}). Skipping until due.");
            return;
        }

        try {
            $platforms = is_string($this->postRequest->target_platforms)
                ? json_decode($this->postRequest->target_platforms, true)
                : $this->postRequest->target_platforms;

            if (!is_array($platforms)) {
                $platforms = [];
            }

            $lowerPlatforms = array_unique(array_map(fn ($platform) => match (strtolower(trim($platform))) {
                'fb' => 'facebook',
                'ig' => 'instagram',
                'portal', 'website', 'wp' => 'wordpress',
                default => strtolower(trim($platform)),
            }, $platforms));
            $completed = PublishingRecord::where('post_request_id', $this->postRequest->id)
                ->where('status', 'published')->whereIn('platform', $lowerPlatforms)
                ->pluck('platform')->all();
            $publishResults = [];
            $publishErrors = [];

            // Retrieve all attached image media in deterministic order (featured first, then sort_order)
            $allImages = $this->postRequest->media()
                ->where(function ($query) {
                    $query->where('type', 'image')
                        ->orWhere('mime_type', 'like', 'image/%');
                })
                ->orderByDesc('is_featured')
                ->orderBy('sort_order')
                ->get();
            $media = $allImages->first();

            if ($this->postRequest->status !== PostRequest::STATUS_PUBLISHING) {
                $this->postRequest->update(['status' => PostRequest::STATUS_PUBLISHING]);
            }

            if (in_array('instagram', $lowerPlatforms, true) && !in_array('instagram', $completed, true)) {
                try {
                    $imageUrls = $allImages->map(function ($m) {
                        return route('instagram.media', ['media' => $m->id]);
                    })->values()->all();

                    $igPayload = count($imageUrls) > 1 ? $imageUrls : ($imageUrls[0] ?? null);
                    $publishResults['instagram'] = $instagramService->publishPost($this->postRequest->caption_narrative ?? '', $igPayload);
                    Log::info("AutoPublishJob: Successfully published to Instagram for post ID {$this->postRequest->id}");
                } catch (Exception $e) {
                    $publishErrors['instagram'] = $this->friendlyPublishError($e->getMessage());
                    Log::error('AutoPublishJob: Publish to Instagram failed: ' . $e->getMessage());
                }
            }

            if (in_array('facebook', $lowerPlatforms, true) && !in_array('facebook', $completed, true)) {
                $mediaPaths = $allImages->map(function ($m) {
                    if (!$m->file_path) {
                        return null;
                    }
                    $disk = config('filesystems.default');
                    if (in_array($disk, ['s3', 'b2'], true)) {
                        return $m->url ?? Storage::disk($disk)->url($m->file_path);
                    }
                    $localPath = Storage::disk('public')->path($m->file_path);
                    return file_exists($localPath) ? $localPath : route('instagram.media', ['media' => $m->id]);
                })->filter()->values()->all();

                $fbPayload = count($mediaPaths) > 1 ? $mediaPaths : ($mediaPaths[0] ?? null);

                try {
                    $publishResults['facebook'] = $facebookService->publishPost($this->postRequest->caption_narrative ?? '', $fbPayload);
                    Log::info("AutoPublishJob: Successfully published to Facebook for post ID {$this->postRequest->id}");
                } catch (Exception $e) {
                    $publishErrors['facebook'] = $this->friendlyPublishError($e->getMessage());
                    Log::error('AutoPublishJob: Publish to Facebook failed: ' . $e->getMessage());
                }
            }

            if (in_array('wordpress', $lowerPlatforms, true) && !in_array('wordpress', $completed, true)) {
                if (!$wordpressService->isConfigured()) {
                    $publishErrors['wordpress'] = 'Website (WordPress) is not configured in Platform Tokens (application password or URL missing). Automatic publishing skipped.';
                    Log::warning("AutoPublishJob: Post ID {$this->postRequest->id} skipped WordPress because credentials are not configured.");
                } else {
                    try {
                        $publishResults['wordpress'] = $wordpressService->publishPost($this->postRequest, $media, $allImages);
                        Log::info("AutoPublishJob: Successfully published to WordPress for post ID {$this->postRequest->id}");
                    } catch (Exception $e) {
                        $publishErrors['wordpress'] = $e->getMessage();
                        Log::error('AutoPublishJob: Publish to WordPress failed: ' . $e->getMessage());
                    }
                }
            }

            foreach (array_diff($lowerPlatforms, ['facebook', 'instagram', 'wordpress']) as $unsupported) {
                $publishErrors[$unsupported] = 'This platform is not supported for automatic publishing.';
            }
            $this->recordPublishingResults($publishResults, $publishErrors);

            $successfulPlatforms = array_merge($completed, array_keys($publishResults));

            if ($publishErrors !== [] || ($publishResults === [] && $completed === [])) {
                // If in local development environment (and not running unit tests) and nothing was attempted/configured, fallback to simulated publish
                if (!app()->runningUnitTests() && (app()->environment('local') || config('app.env') === 'local') && empty($publishResults) && empty($publishErrors)) {
                    foreach ($lowerPlatforms as $p) {
                        PublishingRecord::updateOrCreate(
                            ['post_request_id' => $this->postRequest->id, 'platform' => $p],
                            [
                                'published_by' => $this->publishedBy,
                                'status' => 'published',
                                'external_post_id' => 'sim_' . $p . '_' . time(),
                                'external_url' => 'https://' . $p . '.com/posts/' . $this->postRequest->id,
                                'published_at' => now(),
                                'platform_response' => ['note' => 'Simulated publish in development environment'],
                            ]
                        );
                    }
                    $successfulPlatforms = $lowerPlatforms;
                } else {
                    $this->postRequest->update(['status' => PostRequest::STATUS_PUBLISH_FAILED]);
                    throw new Exception($this->formatPublishErrors($publishErrors));
                }
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

            $allResults = PublishingRecord::where('post_request_id', $this->postRequest->id)
                ->where('status', 'published')->whereIn('platform', $lowerPlatforms)
                ->pluck('platform_response', 'platform')->all();
            $this->notifyITAdmins(new PostPublishedSuccessNotification($this->postRequest, $allResults), 'success');

            // Notify the requestor that their post was published
            try {
                $freshPost = $this->postRequest->fresh(['requestor', 'category']);
                if ($freshPost && $freshPost->requestor) {
                    Log::info("AutoPublishJob: Notifying requestor ID {$freshPost->requestor->id} ({$freshPost->requestor->email}) of publish for post {$this->postRequest->id}");
                    Notification::sendNow($freshPost->requestor, new PostPublishedRequestorNotification($freshPost, $allResults));
                    Log::info("AutoPublishJob: Successfully notified requestor of publish for post ID {$this->postRequest->id}");
                } else {
                    Log::warning("AutoPublishJob: Post ID {$this->postRequest->id} has no requestor attached to notify of publish");
                }
            } catch (\Throwable $e) {
                Log::error("AutoPublishJob: Failed to notify requestor of publish for post ID {$this->postRequest->id}: {$e->getMessage()}\n" . $e->getTraceAsString());
            }

            Log::info("AutoPublishJob: Completed for post ID {$this->postRequest->id}");
        } catch (Exception $e) {
            Log::error("AutoPublishJob: FAILED for post ID {$this->postRequest->id}. Error: {$e->getMessage()}");

            $this->postRequest->update(['status' => PostRequest::STATUS_PUBLISH_FAILED]);
            $this->notifyITAdmins(new PostPublishingFailedNotification($this->postRequest, $e->getMessage()), 'failure');
            try { \App\Services\AuditLogService::log('POST_PUBLISH_FAILED', "Failed to auto-publish post \"{$this->postRequest->title}\": {$e->getMessage()}", 'ERROR', ['postId' => $this->postRequest->id, 'error' => $e->getMessage()]); } catch (\Throwable $_) {}

            throw $e;
        }
    }

    public function failed(Exception $exception): void
    {
        Log::critical("AutoPublishJob: All retries exhausted for post ID {$this->postRequest->id}. Final error: {$exception->getMessage()}");

        $this->postRequest->update(['status' => PostRequest::STATUS_PUBLISH_FAILED]);
        try { \App\Services\AuditLogService::log('POST_PUBLISH_FAILED', "All retries exhausted for post \"{$this->postRequest->title}\": {$exception->getMessage()}", 'ERROR', ['postId' => $this->postRequest->id, 'error' => $exception->getMessage()]); } catch (\Throwable $_) {}

        $this->notifyITAdmins(new PostPublishingFailedNotification(
            $this->postRequest,
            'All automatic retry attempts failed. Manual publishing required. Error: ' . $exception->getMessage()
        ), 'failure');
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
        if ($platform === 'wordpress') {
            return $response['link'] ?? null;
        }
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

    private function notifyITAdmins(object $notification, string $type = 'failure'): void
    {
        try {
            $cacheKey = "post_publish_{$type}_alert_sent_" . $this->postRequest->id;
            if (\Illuminate\Support\Facades\Cache::has($cacheKey)) {
                Log::info("Skipping duplicate {$type} admin notification for post {$this->postRequest->id}");
                return;
            }
            \Illuminate\Support\Facades\Cache::put($cacheKey, true, now()->addHours(2));
            $itAdmins = User::whereHas('roles', fn ($query) => $query->whereIn('name', ['it_publisher', 'it_admin', 'admin']))
                ->where('status', 'active')
                ->get();

            if ($itAdmins->isNotEmpty()) {
                Notification::sendNow($itAdmins, $notification);
                Log::info("AutoPublishJob: Sent {$type} admin notification to " . $itAdmins->pluck('email')->implode(', ') . " for post {$this->postRequest->id}");
            }
        } catch (Exception $e) {
            Log::error('AutoPublishJob: Failed to send admin notification. Error: ' . $e->getMessage());
        }
    }
}
