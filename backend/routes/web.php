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

Route::get('/test-posts', function() {
    return \App\Http\Resources\Api\PostRequestResource::collection(\App\Models\PostRequest::with('media')->get());
});

Route::get('/test-s3', function() {
    try {
        $result = \Illuminate\Support\Facades\Storage::disk('s3')->put('test.txt', 'Hello S3');
        return "Upload success: " . ($result ? 'true' : 'false');
    } catch (\Exception $e) {
        return "Exception: " . $e->getMessage();
    }
});

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