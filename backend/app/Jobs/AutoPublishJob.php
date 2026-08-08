<?php

namespace App\Jobs;

use App\Models\PostRequest;
use App\Models\User;
use App\Notifications\PostPublishedSuccessNotification;
use App\Notifications\PostPublishingFailedNotification;
use App\Services\FacebookPublishingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Exception;

class AutoPublishJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 3;

    /**
     * The number of seconds to wait before retrying the job.
     */
    public array $backoff = [30, 60, 120];

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 120;

    public function __construct(public PostRequest $postRequest) {}

    public function handle(FacebookPublishingService $facebookService): void
    {
        Log::info("AutoPublishJob: Starting auto-publish for post ID {$this->postRequest->id} — '{$this->postRequest->title}'");

        try {
            $platforms = is_string($this->postRequest->target_platforms)
                ? json_decode($this->postRequest->target_platforms, true)
                : $this->postRequest->target_platforms;

            if (!is_array($platforms)) {
                $platforms = [];
            }

            $lowerPlatforms = array_map('strtolower', $platforms);
            $publishResults = [];

            // --- Publish to Facebook ---
            if (in_array('facebook', $lowerPlatforms) || in_array('fb', $lowerPlatforms)) {
                $media = $this->postRequest->media()->first();
                $mediaPath = null;

                if ($media && $media->file_path) {
                    $disk = config('filesystems.default');
                    if (in_array($disk, ['s3', 'b2'])) {
                        $mediaPath = $media->url ?? Storage::disk($disk)->url($media->file_path);
                    } else {
                        $mediaPath = Storage::disk('public')->path($media->file_path);
                    }
                }

                $message = $this->postRequest->caption_narrative ?? '';
                $fbResponse = $facebookService->publishPost($message, $mediaPath);
                $publishResults['facebook'] = $fbResponse;

                Log::info("AutoPublishJob: Successfully published to Facebook for post ID {$this->postRequest->id}");
            }

            // Update post status to published
            $this->postRequest->update(['status' => PostRequest::STATUS_PUBLISHED]);

            // Log the audit trail
            \App\Services\AuditLogService::log(
                'AUTO_PUBLISHED',
                "Auto-published post \"{$this->postRequest->title}\" to selected platforms.",
                'INFO',
                ['postId' => $this->postRequest->id, 'platforms' => $platforms, 'results' => $publishResults]
            );

            // Notify IT Admins of success
            $this->notifyITAdmins(new PostPublishedSuccessNotification($this->postRequest, $publishResults));

            Log::info("AutoPublishJob: Completed for post ID {$this->postRequest->id}");

        } catch (Exception $e) {
            Log::error("AutoPublishJob: FAILED for post ID {$this->postRequest->id}. Error: {$e->getMessage()}");

            // Mark the post as publish failed
            $this->postRequest->update(['status' => PostRequest::STATUS_PUBLISH_FAILED]);

            // Notify IT Admins of failure
            $this->notifyITAdmins(new PostPublishingFailedNotification($this->postRequest, $e->getMessage()));

            // Rethrow to let the queue retry mechanism work
            throw $e;
        }
    }

    /**
     * Handle a job failure (after all retries are exhausted).
     */
    public function failed(Exception $exception): void
    {
        Log::critical("AutoPublishJob: All retries exhausted for post ID {$this->postRequest->id}. Final error: {$exception->getMessage()}");

        // Mark post as permanently failed
        $this->postRequest->update(['status' => PostRequest::STATUS_PUBLISH_FAILED]);

        // Send urgent final failure notification to IT Admins
        $this->notifyITAdmins(new PostPublishingFailedNotification(
            $this->postRequest,
            "All automatic retry attempts failed. Manual publishing required. Error: " . $exception->getMessage()
        ));
    }

    /**
     * Find all active IT Admin users and send them the notification.
     */
    private function notifyITAdmins(object $notification): void
    {
        try {
            $itAdmins = User::whereHas('roles', function ($query) {
                $query->where('name', 'admin');
            })->where('department', 'Information Technology Office')
              ->where('status', 'active')
              ->get();

            if ($itAdmins->isNotEmpty()) {
                Notification::send($itAdmins, $notification);
            } else {
                // Fallback: notify any admin
                $admins = User::whereHas('roles', function ($query) {
                    $query->where('name', 'admin');
                })->where('status', 'active')->get();

                if ($admins->isNotEmpty()) {
                    Notification::send($admins, $notification);
                }
            }
        } catch (Exception $e) {
            Log::error("AutoPublishJob: Failed to send admin notification. Error: " . $e->getMessage());
        }
    }
}
