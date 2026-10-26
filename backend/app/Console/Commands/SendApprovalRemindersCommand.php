<?php

namespace App\Console\Commands;

use App\Models\PostRequest;
use App\Services\ApprovalWorkflowService;
use Illuminate\Console\Command;

class SendApprovalRemindersCommand extends Command
{
    protected $signature = 'posts:send-reminders 
                            {--post_id= : Specific post request ID to send reminder for}
                            {--hours=24 : Minimum hours pending before sending reminder}
                            {--force : Force send reminder regardless of pending time}';

    protected $description = 'Send reminder notifications to approvers for pending post requests';

    public function handle(ApprovalWorkflowService $workflowService): int
    {
        $postId = $this->option('post_id');
        $hours = (int) $this->option('hours');
        $force = (bool) $this->option('force');

        $query = PostRequest::where('status', PostRequest::STATUS_PENDING)
            ->with(['approvalWorkflows.approver', 'requestor', 'category']);

        if ($postId) {
            $query->where('id', $postId);
        } elseif (!$force) {
            $cutoff = now()->subHours($hours);
            $query->where('created_at', '<=', $cutoff);
        }

        $pendingPosts = $query->get();

        if ($pendingPosts->isEmpty()) {
            $this->info('No pending post requests requiring reminders.');
            return self::SUCCESS;
        }

        $sentCount = 0;
        foreach ($pendingPosts as $post) {
            $currentStage = $post->currentApprovalStage();
            if (!$currentStage) {
                continue;
            }

            $success = $workflowService->sendApprovalReminder($post, $currentStage->stage);
            if ($success) {
                $sentCount++;
                $this->line("Sent reminder for post #{$post->id} ('{$post->title}') at stage '{$currentStage->stage}'.");
            }
        }

        $this->info("Completed: Sent {$sentCount} approval reminder(s).");
        return self::SUCCESS;
    }
}
