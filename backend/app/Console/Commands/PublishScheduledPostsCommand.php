<?php

namespace App\Console\Commands;

use App\Jobs\AutoPublishJob;
use App\Models\PostRequest;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class PublishScheduledPostsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'postflow:publish-scheduled';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Scan and trigger auto-publishing for posts scheduled up to the current time';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $now = now();
        $this->info("Checking for scheduled posts due up to {$now->toDateTimeString()}...");

        $duePosts = PostRequest::where('status', PostRequest::STATUS_SCHEDULED)
            ->where(function ($query) use ($now) {
                $query->where(function ($q) use ($now) {
                    $q->whereNotNull('preferred_schedule_at')
                      ->where('preferred_schedule_at', '<=', $now);
                })->orWhereHas('publishingRecords', function ($q) use ($now) {
                    $q->where('status', 'scheduled')
                      ->whereNotNull('scheduled_at')
                      ->where('scheduled_at', '<=', $now);
                });
            })
            ->get();

        if ($duePosts->isEmpty()) {
            $this->info('No scheduled posts due for publishing.');
            return Command::SUCCESS;
        }

        $this->info("Found {$duePosts->count()} scheduled post(s) to publish.");

        foreach ($duePosts as $post) {
            $this->line("Dispatching AutoPublishJob for post #{$post->id}: {$post->title}");
            Log::info("PublishScheduledPostsCommand: Dispatching auto-publish for post #{$post->id}");

            // Update status to publishing to prevent duplicate processing
            $post->update(['status' => PostRequest::STATUS_PUBLISHING]);

            // Dispatch publishing job
            AutoPublishJob::dispatch($post);
        }

        $this->info('All scheduled posts successfully queued.');
        return Command::SUCCESS;
    }
}
