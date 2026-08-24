<?php

use Illuminate\Support\Facades\Route;

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