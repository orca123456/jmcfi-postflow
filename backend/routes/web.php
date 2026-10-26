<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use App\Models\PostMedia;
use App\Models\User;
use App\Http\Controllers\Api\SanctumSecurity\AuthController;
use App\Http\Controllers\Api\EmailSettingController;

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

Route::get('/instagram-media/{media}.jpg', function (PostMedia $media) {
    if ($media->type !== 'image' && !str_starts_with((string) $media->mime_type, 'image/')) {
        abort(404);
    }

    $path = str_replace('\\', '/', $media->file_path);
    $disk = config('filesystems.default');
    $storageDisk = in_array($disk, ['s3', 'b2'], true) ? $disk : 'public';
    $content = null;

    try {
        if (Storage::disk($storageDisk)->exists($path)) {
            $content = Storage::disk($storageDisk)->get($path);
        }
    } catch (Throwable) {
        $content = null;
    }

    if ($content === null && Schema::hasTable('post_media_files')) {
        $media->loadMissing('file:id,post_media_id,content');
        $content = $media->file?->content;

        if (is_resource($content)) {
            $content = stream_get_contents($content);
        }

        if (is_string($content) && str_starts_with($content, '\\x')) {
            $content = hex2bin(substr($content, 2)) ?: null;
        }
    }

    if ($content === null) {
        abort(404);
    }

    $image = @imagecreatefromstring($content);
    if (!$image) {
        abort(404);
    }

    ob_start();
    imagejpeg($image, null, 92);
    imagedestroy($image);
    $jpeg = ob_get_clean();

    return response($jpeg, 200, [
        'Content-Type' => 'image/jpeg',
        'Content-Length' => (string) strlen($jpeg),
        'Cache-Control' => 'public, max-age=31536000, immutable',
    ]);
})->name('instagram.media');

Route::match(['GET', 'HEAD', 'OPTIONS'], '/profile-photo/{user}', [AuthController::class, 'getPhoto'])->whereNumber('user')->name('profile.photo');
Route::match(['GET', 'HEAD', 'OPTIONS'], '/email-template-logo', [EmailSettingController::class, 'getLogo'])->name('email.template.logo');

Route::get('/storage/{path}', function (string $path) {
    $filename = basename($path);
    $directory = trim(dirname($path), '/\\.');
    $cleanPath = (!empty($directory) && $directory !== '.') ? $directory . '/' . $filename : $filename;

    if (empty($cleanPath) || str_contains($path, '..') || str_starts_with($path, '/')) {
        abort(404);
    }

    $disk = config('filesystems.default');
    $storageDisk = in_array($disk, ['s3', 'b2'], true) ? $disk : 'public';

    try {
        if (Storage::disk($storageDisk)->exists($cleanPath)) {
            $storageRoot = realpath(storage_path('app/public')) ?: storage_path('app/public');
            $fullPath = Storage::disk($storageDisk)->path($cleanPath);
            $realPath = realpath($fullPath);

            if ($realPath && str_starts_with($realPath, $storageRoot)) {
                return response()->file($realPath, [
                    'Cache-Control' => 'public, max-age=31536000, immutable',
                ]);
            }
        }
    } catch (Throwable) {
        // Fallback to database media table
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

    if (is_string($content) && str_starts_with($content, '\\x')) {
        $content = hex2bin(substr($content, 2)) ?: null;
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

// Dev-only email template previews. Off unless ENABLE_EMAIL_PREVIEWS=true.
if (filter_var(env('ENABLE_EMAIL_PREVIEWS', false), FILTER_VALIDATE_BOOLEAN)) {
Route::get('/email-previews/raw/{type}', function (string $type) {
    $requestor = new \App\Models\User([
        'first_name' => 'Den',
        'last_name'  => 'Mark',
        'department' => 'BSA',
    ]);

    $post = new \App\Models\PostRequest([
        'title'            => 'Test',
        'target_platforms' => ['facebook', 'instagram'],
    ]);
    $post->setRelation('requestor', $requestor);

    switch ($type) {
        case 'approver-dept-head':
            $approver = new \App\Models\User(['first_name' => 'Ruel', 'last_name' => 'Arana']);
            $mail = (new \App\Notifications\ApprovalNeededNotification($post, 'office_head'))->toMail($approver);
            break;

        case 'approver-vp':
            $approver = new \App\Models\User(['first_name' => 'Elena', 'last_name' => 'Santos']);
            $mail = (new \App\Notifications\ApprovalNeededNotification($post, 'vice_president'))->toMail($approver);
            break;

        case 'approver-imc':
            $approver = new \App\Models\User(['first_name' => 'Angela', 'last_name' => 'Cruz']);
            $mail = (new \App\Notifications\ApprovalNeededNotification($post, 'imc_qa'))->toMail($approver);
            break;

        case 'requestor-dept-head':
            $mail = (new \App\Notifications\PostApprovedNotification($post, 'office_head', 'Ruel Arana'))->toMail($requestor);
            break;

        case 'requestor-vp':
            $mail = (new \App\Notifications\PostApprovedNotification($post, 'vice_president', 'Elena Santos'))->toMail($requestor);
            break;

        case 'requestor-imc':
            $mail = (new \App\Notifications\PostApprovedNotification($post, 'imc_qa', 'Angela Cruz'))->toMail($requestor);
            break;

        case 'requestor-revision':
            $mail = (new \App\Notifications\PostReturnedForRevisionNotification(
                $post,
                'Please adjust the image aspect ratio and add institutional hashtags.',
                ['Branding' => ['Ensure high-resolution header', 'Include official hashtag']]
            ))->toMail($requestor);
            break;

        case 'requestor-rejected':
            $mail = (new \App\Notifications\PostRejectedNotification($post, 'Post topic does not align with academic calendar schedule.'))->toMail($requestor);
            break;

        default:
            abort(404, 'Unknown preview type');
    }

    return view('emails.custom-template', $mail->viewData);
})->name('email.preview.raw');

Route::get('/email-previews/{type?}', function (?string $type = 'approver-dept-head') {
    $previews = [
        'approver-dept-head' => ['label' => 'Approver: Dept Head', 'group' => 'Approvers'],
        'approver-vp'        => ['label' => 'Approver: Vice President', 'group' => 'Approvers'],
        'approver-imc'       => ['label' => 'Approver: IMC', 'group' => 'Approvers'],
        'requestor-dept-head'=> ['label' => 'Approved: Dept Head', 'group' => 'Requestors'],
        'requestor-vp'       => ['label' => 'Approved: VP (VPAA)', 'group' => 'Requestors'],
        'requestor-imc'      => ['label' => 'Approved: IMC Final', 'group' => 'Requestors'],
        'requestor-revision' => ['label' => 'Revision Required', 'group' => 'Requestors'],
        'requestor-rejected' => ['label' => 'Post Rejected', 'group' => 'Requestors'],
    ];

    if (!array_key_exists($type, $previews)) {
        $type = 'approver-dept-head';
    }

    $rawUrl = url("/email-previews/raw/{$type}");

    return response('<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JMCFI PostFlow — Email Notification Previewer</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
        .topbar { background: #1e1b4b; border-bottom: 1px solid #312e81; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .brand { font-size: 15px; font-weight: 800; color: #ffffff; display: flex; align-items: center; gap: 8px; }
        .badge { background: #430c7b; color: #ede9fe; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .tabs { display: flex; gap: 6px; flex-wrap: wrap; }
        .tab-btn { display: inline-block; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none; color: #cbd5e1; background: #1e293b; border: 1px solid #334155; transition: all 0.15s; }
        .tab-btn:hover { background: #334155; color: #ffffff; }
        .tab-btn.active { background: #6b21a8; border-color: #9333ea; color: #ffffff; font-weight: 700; box-shadow: 0 2px 8px rgba(147, 51, 234, 0.4); }
        .controls { display: flex; align-items: center; gap: 8px; }
        .device-btn { background: #1e293b; border: 1px solid #334155; color: #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .device-btn.active { background: #430c7b; border-color: #6b21a8; color: #ffffff; }
        .preview-area { flex: 1; background: #0b0f19; display: flex; justify-content: center; align-items: stretch; padding: 20px; overflow: auto; }
        .frame-wrapper { width: 100%; max-width: 540px; height: 100%; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5); border: 1px solid #334155; transition: max-width 0.25s ease; }
        iframe { width: 100%; height: 100%; border: none; }
    </style>
</head>
<body>
    <div class="topbar">
        <div class="brand">
            <span>JMCFI PostFlow</span>
            <span class="badge">Email Template Previewer</span>
        </div>
        <div class="tabs">
            ' . implode('', array_map(function($key, $item) use ($type) {
                $cls = $key === $type ? 'tab-btn active' : 'tab-btn';
                return '<a href="/email-previews/' . $key . '" class="' . $cls . '">' . htmlspecialchars($item['label']) . '</a>';
            }, array_keys($previews), $previews)) . '
        </div>
        <div class="controls">
            <button class="device-btn" onclick="document.querySelector(\'.frame-wrapper\').style.maxWidth=\'540px\'; this.classList.add(\'active\'); document.getElementById(\'wideBtn\').classList.remove(\'active\');" id="mobileBtn">Email View (540px)</button>
            <button class="device-btn" onclick="document.querySelector(\'.frame-wrapper\').style.maxWidth=\'760px\'; this.classList.add(\'active\'); document.getElementById(\'mobileBtn\').classList.remove(\'active\');" id="wideBtn">Wide View (760px)</button>
            <a href="' . $rawUrl . '" target="_blank" class="device-btn" style="text-decoration:none; color:#c084fc;">Open Raw ↗</a>
        </div>
    </div>
    <div class="preview-area">
        <div class="frame-wrapper">
            <iframe src="' . $rawUrl . '" title="Email Preview"></iframe>
        </div>
    </div>
</body>
</html>');
})->name('email.previews');
}

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
