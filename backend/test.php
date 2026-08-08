<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$users = \App\Models\User::all(['id', 'email', 'first_name', 'department']);
foreach($users as $user) {
    echo "ID: {$user->id} | Email: {$user->email} | Dept: {$user->department} | Role: " . $user->getRoleNames()->first() . "\n";
}
echo "\n--- POSTS ---\n";
$posts = \App\Models\PostRequest::with('requestor')->get();
foreach($posts as $post) {
    echo "Post ID: {$post->id} | Status: {$post->status} | ReqDept: " . ($post->requestor->department ?? 'null') . "\n";
}
