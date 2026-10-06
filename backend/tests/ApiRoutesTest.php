<?php

namespace Tests;

use App\Models\User;
use App\Models\Department;
use App\Models\SystemSetting;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

final class ApiRoutesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
            'cache.default' => 'array',
            'app.key' => 'base64:' . base64_encode(str_repeat('a', 32)),
        ]);

        app('db')->purge('sqlite');

        // Create required tables for API testing
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('employee_id')->nullable();
            $table->string('first_name')->default('Test');
            $table->string('middle_name')->nullable();
            $table->string('last_name')->default('User');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('phone')->nullable();
            $table->string('department')->nullable();
            $table->string('position')->nullable();
            $table->string('status')->default('active');
            $table->string('photo_path')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('guard_name')->default('web');
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('guard_name')->default('web');
            $table->timestamps();
        });

        Schema::create('model_has_roles', function (Blueprint $table) {
            $table->unsignedBigInteger('role_id');
            $table->string('model_type');
            $table->unsignedBigInteger('model_id');
            $table->index(['model_id', 'model_type']);
        });

        Schema::create('model_has_permissions', function (Blueprint $table) {
            $table->unsignedBigInteger('permission_id');
            $table->string('model_type');
            $table->unsignedBigInteger('model_id');
            $table->index(['model_id', 'model_type']);
        });

        Schema::create('role_has_permissions', function (Blueprint $table) {
            $table->unsignedBigInteger('permission_id');
            $table->unsignedBigInteger('role_id');
        });

        Schema::create('post_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->string('icon')->nullable()->default('document');
            $table->string('color')->nullable()->default('#2563EB');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('display_name')->nullable();
            $table->string('code')->nullable();
            $table->string('logo_path')->nullable();
            $table->boolean('is_system')->default(false);
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->string('type')->default('string');
            $table->text('description')->nullable();
            $table->boolean('is_public')->default(false);
            $table->timestamps();
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });

        Schema::create('post_requests', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->nullable();
            $table->text('caption_narrative')->nullable();
            $table->unsignedBigInteger('category_id')->nullable();
            $table->string('other_category_name')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->unsignedBigInteger('requestor_id')->nullable();
            $table->string('status')->default('draft');
            $table->json('target_platforms')->nullable();
            $table->timestamp('preferred_schedule_at')->nullable();
            $table->integer('revision_count')->default(0);
            $table->boolean('is_draft')->default(false);
            $table->timestamps();
        });

        Schema::create('post_media', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('post_request_id');
            $table->string('file_path')->nullable();
            $table->string('media_type')->default('image');
            $table->integer('order')->default(0);
            $table->boolean('is_featured')->default(false);
            $table->timestamps();
        });

        Schema::create('approval_workflows', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('post_request_id');
            $table->string('stage');
            $table->unsignedBigInteger('approver_id')->nullable();
            $table->string('action')->default('pending');
            $table->text('comments')->nullable();
            $table->timestamps();
        });

        Schema::create('policy_violations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('post_request_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('policy_type')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('action');
            $table->text('description')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamps();
        });

        Role::firstOrCreate(['name' => 'it_admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'requestor', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'it_publisher', 'guard_name' => 'web']);
    }

    private function createTestUser(string $role = 'requestor'): User
    {
        $user = User::create([
            'first_name' => 'Test',
            'last_name' => ucfirst($role),
            'email' => "{$role}_" . uniqid() . '@example.com',
            'password' => Hash::make('password123'),
            'status' => 'active',
        ]);
        $user->assignRole($role);
        return $user;
    }

    // --- 1. PUBLIC ROUTES ---
    public function test_health_check_endpoint_returns_success(): void
    {
        $response = $this->getJson('/api/health');
        $response->assertStatus(200);
        $this->assertEquals('healthy', $response->json('status'));
    }

    // --- 2. AUTHENTICATION PROTECTION ---
    public function test_unauthenticated_requests_are_rejected_with_401(): void
    {
        $protectedRoutes = [
            ['GET', '/api/user'],
            ['GET', '/api/notifications'],
            ['GET', '/api/posts'],
            ['GET', '/api/categories'],
            ['GET', '/api/departments'],
            ['GET', '/api/dashboard/stats'],
            ['GET', '/api/ai-settings'],
            ['GET', '/api/users'],
            ['GET', '/api/token-settings'],
            ['GET', '/api/audit-logs'],
        ];

        foreach ($protectedRoutes as [$method, $uri]) {
            $response = $this->json($method, $uri);
            $response->assertStatus(401);
        }
    }

    public function test_login_validation_rejects_missing_fields(): void
    {
        $response = $this->postJson('/api/auth/login', []);
        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        $user = $this->createTestUser('requestor');

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);

        $this->assertTrue(in_array($response->status(), [401, 422]));
    }

    // --- 3. ROLE-BASED ACCESS CONTROL (RBAC) ---
    public function test_requestor_cannot_access_admin_user_management(): void
    {
        $requestor = $this->createTestUser('requestor');
        Sanctum::actingAs($requestor);

        $response = $this->getJson('/api/users');
        $response->assertStatus(403);
    }

    public function test_requestor_cannot_access_admin_ai_settings(): void
    {
        $requestor = $this->createTestUser('requestor');
        Sanctum::actingAs($requestor);

        $response = $this->getJson('/api/ai-settings');
        $response->assertStatus(403);
    }

    public function test_requestor_cannot_access_token_settings(): void
    {
        $requestor = $this->createTestUser('requestor');
        Sanctum::actingAs($requestor);

        $response = $this->getJson('/api/token-settings');
        $response->assertStatus(403);
    }

    public function test_requestor_cannot_access_audit_logs(): void
    {
        $requestor = $this->createTestUser('requestor');
        Sanctum::actingAs($requestor);

        $response = $this->getJson('/api/audit-logs');
        $response->assertStatus(403);
    }

    public function test_admin_can_access_ai_settings(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/ai-settings');
        $response->assertStatus(200)
                 ->assertJsonStructure(['provider', 'model', 'providers']);
    }

    public function test_admin_can_access_user_list(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/users');
        $response->assertStatus(200);
    }

    // --- 4. RESOURCE ENDPOINTS ---
    public function test_authenticated_user_can_fetch_categories(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/categories');
        $response->assertStatus(200);
    }

    public function test_authenticated_user_can_fetch_departments(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/departments');
        $response->assertStatus(200);
    }

    public function test_authenticated_user_can_fetch_notifications(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/notifications');
        $response->assertStatus(200);
    }

    // --- 5. POST REQUEST VALIDATION ---
    public function test_post_creation_requires_mandatory_fields(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/posts', []);
        $response->assertStatus(422);
    }

    public function test_draft_post_creation_succeeds_without_media(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/posts', [
            'title' => 'Sample Draft Title',
            'caption_narrative' => 'Sample draft caption content',
            'is_draft' => true,
        ]);

        $response->assertStatus(201);
    }

    // --- 6. AI & CHATBOT VALIDATION ---
    public function test_draft_ai_check_requires_caption(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/posts/ai-check-draft', []);
        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['caption_narrative']);
    }

    public function test_chatbot_message_requires_messages_array(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/chatbot/message', []);
        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['messages']);
    }
}
