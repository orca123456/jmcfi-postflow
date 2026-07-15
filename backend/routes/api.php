<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PostRequestController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\PublishingController;
use App\Http\Controllers\Api\ViolationController;
use App\Http\Controllers\Api\AIComplianceController;

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

// Auth routes
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
Route::get('/auth/user', [AuthController::class, 'user'])->middleware('auth:sanctum');
Route::put('/auth/profile', [AuthController::class, 'updateProfile'])->middleware('auth:sanctum');
Route::put('/auth/password', [AuthController::class, 'updatePassword'])->middleware('auth:sanctum');

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Post Requests
    Route::apiResource('posts', PostRequestController::class)->only(['index', 'store', 'show', 'update', 'destroy']);
    Route::post('posts/{post}/submit', [PostRequestController::class, 'submitForApproval']);
    Route::post('posts/{post}/approve', [PostRequestController::class, 'approve']);
    Route::post('posts/{post}/reject', [PostRequestController::class, 'reject']);
    Route::post('posts/{post}/return-revision', [PostRequestController::class, 'returnForRevision']);
    Route::post('posts/{post}/ai-check', [PostRequestController::class, 'runAiCheck']);
    Route::get('posts/dashboard/stats', [PostRequestController::class, 'getDashboardStats']);

    // Categories
    Route::apiResource('categories', CategoryController::class)->only(['index', 'store', 'show', 'update', 'destroy']);

    // Users (Admin only)
    Route::apiResource('users', UserController::class)->only(['index', 'store', 'show', 'update', 'destroy']);
    Route::get('users/roles', [UserController::class, 'getRoles']);

    // Dashboard
    Route::get('dashboard/stats', [DashboardController::class, 'getStats']);
    Route::get('dashboard/recent-activity', [DashboardController::class, 'getRecentActivity']);
    Route::get('dashboard/violation-trends', [DashboardController::class, 'getViolationTrends']);

    // Publishing
    Route::apiResource('publishing', PublishingController::class)->only(['index', 'show']);
    Route::post('publishing/{post}/schedule', [PublishingController::class, 'schedule']);
    Route::post('publishing/{post}/publish', [PublishingController::class, 'publish']);
    Route::post('publishing/{post}/cancel', [PublishingController::class, 'cancel']);

    // Policy Violations
    Route::apiResource('violations', ViolationController::class)->only(['index', 'show', 'update']);
    Route::post('violations/{violation}/resolve', [ViolationController::class, 'resolve']);
    Route::get('violations/dashboard/stats', [ViolationController::class, 'getDashboardStats']);

    // AI Compliance
    Route::post('ai/check/{post}', [AIComplianceController::class, 'checkCompliance']);
    Route::post('ai/generate-rejection-reason/{post}', [AIComplianceController::class, 'generateRejectionReason']);
    Route::post('ai/improve-caption/{post}', [AIComplianceController::class, 'improveCaption']);
});