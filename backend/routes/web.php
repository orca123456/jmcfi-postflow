<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use App\Models\PostMedia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

// NOTE: two debug routes used to live here — GET /test-posts, which returned
// every PostRequest with its media to anyone on the internet, and GET /test-s3,
// which wrote to the S3 disk. Both were unauthenticated. Do not add debug
// routes to this file; it is served publicly alongside the SPA.

Route::get('/storage/{path}', function (string $path) {
    $path = str_replace('\\', '/', $path);

    if (str_contains($path, '..') || str_starts_with($path, '/')) {
        abort(404);
    }

    if (Storage::disk('public')->exists($path)) {
        return response()->file(Storage::disk('public')->path($path), [
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }

    if (!Schema::hasTable('post_media_files')) {
        abort(404);
    }

    $media = PostMedia::query()
        ->where('file_path', $path)
        ->with('file:id,post_media_id,content')
        ->first();

    $content = $media?->file?->content;
    if (is_resource($content)) {
        $content = stream_get_contents($content);
    }

    if ($content === null) {
        abort(404);
    }

    return response($content, 200, [
        'Content-Type' => $media->mime_type,
        'Content-Length' => (string) strlen($content),
        'Cache-Control' => 'public, max-age=31536000, immutable',
    ]);
})->where('path', '.*');

Route::get('/{any}', function () {
    $path = public_path('index.html');
    if (file_exists($path)) {
        return file_get_contents($path);
    }
    return response()->json([
        'message' => 'JMCFI PostFlow API (Frontend not built)',
        'status' => 'running',
    ]);
})->where('any', '^(?!api|storage).*$');
