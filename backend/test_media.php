<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$posts = App\Models\PostRequest::with('media')->latest()->take(5)->get();
foreach ($posts as $post) {
    echo "Post ID: {$post->id} - Title: {$post->title}\n";
    foreach ($post->media as $media) {
        echo "  Media ID: {$media->id} - Path: {$media->file_path} - URL: {$media->url} - Storage URL: " . \Storage::disk($media->disk)->url($media->file_path) . "\n";
    }
}
