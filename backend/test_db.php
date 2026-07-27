<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$posts = App\Models\PostRequest::with('approvalWorkflows')->get();
foreach ($posts as $post) {
    echo "Post ID: {$post->id}, Status: {$post->status}\n";
    foreach ($post->approvalWorkflows as $wf) {
        echo "  - WF ID: {$wf->id}, Stage: {$wf->stage}, Order: {$wf->stage_order}, Action: {$wf->action}\n";
    }
}
