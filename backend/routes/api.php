<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PostRequestController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\RoleController;
// use App\Http\Controllers\Api\PublishingController;
// use App\Http\Controllers\Api\ViolationController;
// use App\Http\Controllers\Api\AIComplianceController;
use App\Http\Controllers\Api\ChatbotController;

use App\Http\Controllers\Api\PolicySettingController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\TokenSettingController;
use App\Http\Controllers\Api\ApiTokenController;
use App\Http\Controllers\Api\ExternalIntegrationController;

// NOTE: the former unauthenticated GET /api/magic-seed route ran
// `migrate:fresh` + `db:seed`, i.e. any request to that URL dropped every
// table. Schema changes now run through Railway's pre-deploy command
// (`php artisan migrate --force`) instead. Do not reintroduce a route that
// mutates the schema.

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
Route::post('/auth/profile-photo', [AuthController::class, 'uploadPhoto'])->middleware('auth:sanctum');
Route::delete('/auth/profile-photo', [AuthController::class, 'removePhoto'])->middleware('auth:sanctum');

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Dashboard stats MUST come before apiResource to avoid route collision with {post}
    Route::get('posts/dashboard/stats', [PostRequestController::class, 'getDashboardStats']);

    // Post Requests
    Route::apiResource('posts', PostRequestController::class)
        ->parameters(['posts' => 'postRequest'])
        ->only(['index', 'store', 'show', 'update', 'destroy'])
        ->where(['postRequest' => '[0-9]{1,19}']);
    Route::post('posts/{postRequest}/submit', [PostRequestController::class, 'submitForApproval'])->where(['postRequest' => '[0-9]{1,19}']);
    Route::post('posts/{postRequest}/approve', [PostRequestController::class, 'approve'])->where(['postRequest' => '[0-9]{1,19}']);
    Route::post('posts/{postRequest}/reject', [PostRequestController::class, 'reject'])->where(['postRequest' => '[0-9]{1,19}']);
    Route::post('posts/{postRequest}/return-revision', [PostRequestController::class, 'returnForRevision'])->where(['postRequest' => '[0-9]{1,19}']);
    Route::post('posts/ai-check-draft', [PostRequestController::class, 'runDraftAiCheck']);
    Route::post('posts/{postRequest}/ai-check', [PostRequestController::class, 'runAiCheck'])->where(['postRequest' => '[0-9]{1,19}']);

    // Categories
    Route::get('categories', [CategoryController::class, 'index']);

    // Users (Admin only)
    Route::get('users/roles', [UserController::class, 'getRoles'])->middleware('role:it_publisher,it_admin');
    Route::apiResource('users', UserController::class)->only(['index', 'store', 'show', 'update', 'destroy'])->middleware('role:it_publisher,it_admin');

    // Dashboard
    Route::get('dashboard/init', [DashboardController::class, 'getInitData']);
    Route::get('dashboard/stats', [DashboardController::class, 'getStats']);
    Route::get('dashboard/recent-activity', [DashboardController::class, 'getRecentActivity']);
    Route::get('dashboard/violation-trends', [DashboardController::class, 'getViolationTrends']);
    Route::get('dashboard/analytics', [DashboardController::class, 'getAnalyticsOverview'])->middleware('role:it_publisher,it_admin');
    
    // Audit Logs (Admin only)
    Route::get('audit-logs', [AuditLogController::class, 'index'])->middleware('role:it_publisher,it_admin');

    // Publishing
    // Route::apiResource('publishing', PublishingController::class)->only(['index', 'show']);
    Route::post('publishing/{post}/schedule', [App\Http\Controllers\Api\PublishingController::class, 'schedule']);
    Route::post('publishing/{post}/publish', [App\Http\Controllers\Api\PublishingController::class, 'publish']);
    // Route::post('publishing/{post}/cancel', [App\Http\Controllers\Api\PublishingController::class, 'cancel']);

    // Policy Violations
    // Route::apiResource('violations', ViolationController::class)->only(['index', 'show', 'update']);
    // Route::post('violations/{violation}/resolve', [ViolationController::class, 'resolve']);
    // Route::get('violations/dashboard/stats', [ViolationController::class, 'getDashboardStats']);

    // Policy Settings (update admin only)
    Route::get('policy-settings', [PolicySettingController::class, 'getSettings']);
    Route::post('policy-settings', [PolicySettingController::class, 'updateSettings'])->middleware('role:it_publisher,it_admin');

    // Token Settings (Admin only)
    Route::get('token-settings', [TokenSettingController::class, 'getTokens'])->middleware('role:it_publisher,it_admin');
    Route::post('token-settings', [TokenSettingController::class, 'updateTokens'])->middleware('role:it_publisher,it_admin');

    // Departments (reads open, writes admin only)
    Route::get('departments', [DepartmentController::class, 'index']);
    Route::post('departments', [DepartmentController::class, 'store'])->middleware('role:it_publisher,it_admin');
    Route::put('departments/{department}', [DepartmentController::class, 'update'])->middleware('role:it_publisher,it_admin');
    Route::delete('departments/{department}', [DepartmentController::class, 'destroy'])->middleware('role:it_publisher,it_admin');
    Route::post('departments/{department}/logo', [DepartmentController::class, 'uploadLogo'])->middleware('role:it_publisher,it_admin');
    Route::delete('departments/{department}/logo', [DepartmentController::class, 'removeLogo'])->middleware('role:it_publisher,it_admin');

    // Roles (reads open, writes admin only)
    Route::get('roles/list', [RoleController::class, 'index']);
    Route::post('roles/list', [RoleController::class, 'store'])->middleware('role:it_publisher,it_admin');
    Route::delete('roles/list/{role}', [RoleController::class, 'destroy'])->middleware('role:it_publisher,it_admin');


    Route::post('chatbot/message', [ChatbotController::class, 'handleMessage'])->middleware('auth:sanctum');

// AI Compliance
    // Route::post('ai/check/{post}', [AIComplianceController::class, 'checkCompliance']);
    // Route::post('ai/generate-rejection-reason/{post}', [AIComplianceController::class, 'generateRejectionReason']);
    // Route::post('ai/improve-caption/{post}', [AIComplianceController::class, 'improveCaption']);

    // Email Settings (Admin only)
    Route::get('email-settings', [App\Http\Controllers\Api\EmailSettingController::class, 'getSettings'])->middleware('role:it_publisher,it_admin');
    Route::post('email-settings', [App\Http\Controllers\Api\EmailSettingController::class, 'updateSettings'])->middleware('role:it_publisher,it_admin');
    Route::post('email-settings/test', [App\Http\Controllers\Api\EmailSettingController::class, 'sendTestEmail'])->middleware('role:it_publisher,it_admin');

    // Developer API Tokens (Admin only, or accessible by users)
    Route::get('api-tokens', [ApiTokenController::class, 'index'])->middleware('role:it_publisher,it_admin');
    Route::post('api-tokens', [ApiTokenController::class, 'store'])->middleware('role:it_publisher,it_admin');
    Route::delete('api-tokens/{id}', [ApiTokenController::class, 'destroy'])->middleware('role:it_publisher,it_admin');
    
    // External Integration Endpoint
    Route::post('external/submit-request', [ExternalIntegrationController::class, 'submitRequest']);
});