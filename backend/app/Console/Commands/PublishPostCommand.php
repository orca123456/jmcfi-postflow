<?php

namespace App\Console\Commands;

use App\Jobs\AutoPublishJob;
use App\Models\PostRequest;
use App\Models\PublishingRecord;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Console\Command;

class PublishPostCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'postflow:publish-post 
                            {target : The Post Request ID or Title fragment}
                            {--force : Force publishing even if the post is already marked published}
                            {--user= : User ID to attribute the publishing action to (defaults to first IT Admin)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Safely publish or republish a specific post to its target social media platforms';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $target = $this->argument('target');

        // Locate post by exact ID or case-insensitive title match
        $post = is_numeric($target)
            ? PostRequest::with(['requestor', 'department', 'publishingRecords', 'media'])->find($target)
            : PostRequest::with(['requestor', 'department', 'publishingRecords', 'media'])
                ->where('title', 'ilike', "%{$target}%")
                ->orWhere('title', 'like', "%{$target}%")
                ->latest()
                ->first();

        if (!$post) {
            $this->error("Post not found matching '{$target}'.");
            return Command::FAILURE;
        }

        $this->info("=================================================");
        $this->info("POSTFLOW TARGET POST FOUND");
        $this->info("=================================================");
        $this->line("ID:         {$post->id}");
        $this->line("Title:      {$post->title}");
        $this->line("Department: " . ($post->department?->name ?? 'N/A'));
        $this->line("Requestor:  " . ($post->requestor?->full_name ?? $post->requestor?->name ?? 'N/A'));
        $this->line("Status:     {$post->status}");

        $platforms = is_string($post->target_platforms) ? json_decode($post->target_platforms, true) : $post->target_platforms;
        if (!is_array($platforms) || empty($platforms)) {
            $platforms = ['facebook'];
        }
        $this->line("Platforms:  " . implode(', ', $platforms));
        $this->info("-------------------------------------------------");

        // Display current publishing records
        $existingRecords = $post->publishingRecords;
        if ($existingRecords->isNotEmpty()) {
            $this->line("Current Platform Records:");
            foreach ($existingRecords as $rec) {
                $statusColor = match ($rec->status) {
                    'published' => 'info',
                    'failed' => 'error',
                    default => 'comment',
                };
                $this->line(" - [{$rec->platform}] Status: {$rec->status}" . ($rec->post_id ? " (External ID: {$rec->post_id})" : '') . ($rec->error_message ? " | Error: {$rec->error_message}" : ''));
            }
        } else {
            $this->comment("No platform records recorded yet (never reached publishing step).");
        }
        $this->info("-------------------------------------------------");

        // Verify credentials
        $fbPageId = SystemSetting::where('key', 'facebook_page_id')->value('value') ?: env('FACEBOOK_PAGE_ID');
        $fbToken = SystemSetting::where('key', 'facebook_access_token')->value('value') ?: env('FACEBOOK_PAGE_ACCESS_TOKEN');
        $igId = SystemSetting::where('key', 'instagram_business_account_id')->value('value') ?: env('INSTAGRAM_BUSINESS_ACCOUNT_ID');

        $this->line("Credential Check:");
        $this->line(" - Facebook: " . (!empty($fbPageId) && !empty($fbToken) ? "<info>Configured</info> (Page ID: {$fbPageId})" : "<error>MISSING Page ID or Access Token</error>"));
        $this->line(" - Instagram: " . (!empty($igId) ? "<info>Configured</info> (IG Account: {$igId})" : "<comment>Not explicitly configured (will inherit FB token if mapped)</comment>"));
        $this->info("-------------------------------------------------");

        // Determine user to attribute publish
        $userId = $this->option('user');
        if (!$userId) {
            $adminUser = User::whereHas('roles', fn($q) => $q->whereIn('name', ['it_admin', 'admin', 'it_publisher', 'imc_qa_checker']))->first()
                ?? User::first();
            $userId = $adminUser?->id ?? 1;
        }

        $this->info("Executing AutoPublishJob synchronously for Post ID {$post->id}...");

        try {
            // Run AutoPublishJob synchronously
            AutoPublishJob::dispatchSync($post, $userId);

            // Reload records
            $post->refresh();
            $post->load('publishingRecords');

            $this->info("=================================================");
            $this->info("PUBLISHING JOB FINISHED");
            $this->info("=================================================");
            $this->line("Updated Post Status: {$post->status}");
            foreach ($post->publishingRecords as $rec) {
                if ($rec->status === 'published') {
                    $this->info("✓ [{$rec->platform}] PUBLISHED! External Post ID: {$rec->post_id}" . ($rec->post_url ? " | URL: {$rec->post_url}" : ''));
                } else {
                    $this->error("✗ [{$rec->platform}] Status: {$rec->status} | Error: " . ($rec->error_message ?: 'Unknown error'));
                }
            }
            $this->info("=================================================");

            return Command::SUCCESS;
        } catch (\Throwable $e) {
            $this->error("Publishing failed with exception: " . $e->getMessage());
            return Command::FAILURE;
        }
    }
}
