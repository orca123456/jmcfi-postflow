<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\PostRequest;
use App\Services\ApprovalWorkflowService;

try {
    DB::transaction(function () {
        $post = PostRequest::latest()->first();
        echo "Running notify for post {$post->id}\n";
        
        $service = new ApprovalWorkflowService();
        try {
            $service->notifyApprovers($post);
            echo "Notify completed without throwing inline.\n";
        } catch (\Throwable $e) {
            echo "Caught inline: " . $e->getMessage() . "\n";
        }
    });
    echo "Transaction completed.\n";
} catch (\Throwable $e) {
    echo "Transaction aborted: " . $e->getMessage() . "\n";
}
