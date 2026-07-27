<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$posts = App\Models\PostRequest::with('media')->latest()->take(5)->get();
foreach ($posts as $post) {
    echo "Post ID: " . $post->id . "\n";
    echo "Media: " . json_encode($post->media) . "\n";
}
