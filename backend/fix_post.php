<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$post = \App\Models\PostRequest::find(3);
if ($post) {
    // Add missing workflow stages
    $post->approvalWorkflows()->firstOrCreate([
        'stage' => 'vice_president',
    ], [
        'approver_id' => \App\Models\User::role('vice_president')->first()->id,
        'action' => 'pending',
        'stage_order' => 2,
    ]);
    
    $post->approvalWorkflows()->firstOrCreate([
        'stage' => 'imc_qa',
    ], [
        'approver_id' => \App\Models\User::role('imc_qa_checker')->first()->id,
        'action' => 'pending',
        'stage_order' => 3,
    ]);
    echo "Fixed post 3 workflows\n";
}
