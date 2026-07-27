<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PostRequestController;
// use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\RoleController;
// use App\Http\Controllers\Api\PublishingController;
// use App\Http\Controllers\Api\ViolationController;
// use App\Http\Controllers\Api\AIComplianceController;

use App\Http\Controllers\Api\PolicySettingController;
use App\Http\Controllers\Api\AuditLogController;

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
    // Dashboard stats MUST come before apiResource to avoid route collision with {post}
    Route::get('posts/dashboard/stats', [PostRequestController::class, 'getDashboardStats']);

    // Post Requests
    Route::apiResource('posts', PostRequestController::class)->parameters(['posts' => 'postRequest'])->only(['index', 'store', 'show', 'update', 'destroy']);
    Route::post('posts/{postRequest}/submit', [PostRequestController::class, 'submitForApproval']);
    Route::post('posts/{postRequest}/approve', [PostRequestController::class, 'approve']);
    Route::post('posts/{postRequest}/reject', [PostRequestController::class, 'reject']);
    Route::post('posts/{postRequest}/return-revision', [PostRequestController::class, 'returnForRevision']);
    Route::post('posts/{postRequest}/ai-check', [PostRequestController::class, 'runAiCheck']);

    // Categories
    // Route::apiResource('categories', CategoryController::class)->only(['index', 'store', 'show', 'update', 'destroy']);

    // Users (Admin only)
    Route::get('users/roles', [UserController::class, 'getRoles']);
    Route::apiResource('users', UserController::class)->only(['index', 'store', 'show', 'update', 'destroy']);

    // Dashboard
    Route::get('dashboard/stats', [DashboardController::class, 'getStats']);
    Route::get('dashboard/recent-activity', [DashboardController::class, 'getRecentActivity']);
    Route::get('dashboard/violation-trends', [DashboardController::class, 'getViolationTrends']);
    Route::get('dashboard/analytics', [DashboardController::class, 'getAnalyticsOverview']);
    
    // Audit Logs
    Route::get('audit-logs', [AuditLogController::class, 'index']);

    // Publishing
    // Route::apiResource('publishing', PublishingController::class)->only(['index', 'show']);
    Route::post('publishing/{post}/schedule', [App\Http\Controllers\Api\PublishingController::class, 'schedule']);
    Route::post('publishing/{post}/publish', [App\Http\Controllers\Api\PublishingController::class, 'publish']);
    // Route::post('publishing/{post}/cancel', [App\Http\Controllers\Api\PublishingController::class, 'cancel']);

    // Policy Violations
    // Route::apiResource('violations', ViolationController::class)->only(['index', 'show', 'update']);
    // Route::post('violations/{violation}/resolve', [ViolationController::class, 'resolve']);
    // Route::get('violations/dashboard/stats', [ViolationController::class, 'getDashboardStats']);

    // Policy Settings
    Route::get('policy-settings', [PolicySettingController::class, 'getSettings']);
    Route::post('policy-settings', [PolicySettingController::class, 'updateSettings']);

    // Departments
    Route::get('departments', [DepartmentController::class, 'index']);
    Route::post('departments', [DepartmentController::class, 'store']);
    Route::put('departments/{department}', [DepartmentController::class, 'update']);
    Route::delete('departments/{department}', [DepartmentController::class, 'destroy']);

    // Roles
    Route::get('roles/list', [RoleController::class, 'index']);
    Route::post('roles/list', [RoleController::class, 'store']);
    Route::delete('roles/list/{role}', [RoleController::class, 'destroy']);

    // AI Compliance
    // Route::post('ai/check/{post}', [AIComplianceController::class, 'checkCompliance']);
    // Route::post('ai/generate-rejection-reason/{post}', [AIComplianceController::class, 'generateRejectionReason']);
    // Route::post('ai/improve-caption/{post}', [AIComplianceController::class, 'improveCaption']);
});