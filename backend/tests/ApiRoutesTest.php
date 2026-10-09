<?php

namespace Tests;

use App\Models\User;
use App\Models\Department;
use App\Models\PostCategory;
use App\Models\PostRequest;
use App\Models\SystemSetting;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
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
            'filesystems.default' => 'local',
            'app.key' => 'base64:' . base64_encode(str_repeat('a', 32)),
        ]);

        app('db')->purge('sqlite');
        Model::shouldBeStrict(false);

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'choices' => [
                    ['message' => ['content' => '{"ok":true}'], 'finish_reason' => 'stop'],
                ],
                'usage' => ['total_tokens' => 20],
            ], 200),
            'api.deepseek.com/*' => Http::response([
                'choices' => [
                    ['message' => ['content' => '{"ok":true}'], 'finish_reason' => 'stop'],
                ],
                'usage' => ['total_tokens' => 20],
            ], 200),
            'graph.facebook.com/*/me/permissions*' => Http::response([
                'data' => [
                    ['permission' => 'pages_show_list', 'status' => 'granted'],
                    ['permission' => 'pages_read_engagement', 'status' => 'granted'],
                    ['permission' => 'pages_manage_posts', 'status' => 'granted'],
                    ['permission' => 'instagram_basic', 'status' => 'granted'],
                    ['permission' => 'instagram_content_publish', 'status' => 'granted'],
                ],
            ], 200),
            'graph.facebook.com/*' => Http::response([
                'id' => '61593431116189',
                'name' => 'JMCFI Official',
                'can_post' => true,
                'access_token' => 'EAAFakeTokenForTesting',
            ], 200),
            '*' => Http::response(['success' => true], 200),
        ]);

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
            $table->string('display_name')->nullable();
            $table->text('description')->nullable();
            $table->json('permissions')->nullable();
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
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_system')->default(false);
            $table->json('role_categories')->nullable();
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
            $table->timestamp('published_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->json('revision_notes')->nullable();
            $table->integer('revision_count')->default(0);
            $table->boolean('is_draft')->default(false);
            $table->json('ai_compliance_result')->nullable();
            $table->json('ai_suggested_caption')->nullable();
            $table->json('imc_branding_checklist')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('post_media', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('post_request_id');
            $table->string('file_path')->nullable();
            $table->string('original_name')->nullable();
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('file_size')->default(0);
            $table->string('media_type')->default('image');
            $table->string('type')->default('image');
            $table->integer('order')->default(0);
            $table->integer('sort_order')->default(0);
            $table->boolean('is_featured')->default(false);
            $table->timestamps();
        });

        Schema::create('approval_workflows', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('post_request_id');
            $table->string('stage');
            $table->unsignedBigInteger('approver_id')->nullable();
            $table->string('action')->default('pending');
            $table->integer('stage_order')->default(1);
            $table->text('remarks')->nullable();
            $table->text('comments')->nullable();
            $table->timestamp('acted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('ai_compliance_checks', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('post_request_id');
            $table->unsignedBigInteger('checked_by_user_id')->nullable();
            $table->json('check_results')->nullable();
            $table->json('violations_found')->nullable();
            $table->text('suggested_rejection_reason')->nullable();
            $table->text('suggested_revision_guidance')->nullable();
            $table->string('suggested_improved_caption')->nullable();
            $table->string('overall_status')->default('review_required');
            $table->decimal('confidence_score', 5, 2)->nullable();
            $table->string('model_used')->default('deepseek-chat');
            $table->text('prompt_used')->nullable();
            $table->timestamps();
        });

        Schema::create('policy_violations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('post_request_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('flagged_by')->nullable();
            $table->unsignedBigInteger('flagged_by_user_id')->nullable();
            $table->string('violation_type')->nullable();
            $table->string('policy_type')->nullable();
            $table->text('description')->nullable();
            $table->string('severity')->default('medium');
            $table->json('ai_analysis')->nullable();
            $table->boolean('is_resolved')->default(false);
            $table->timestamp('resolved_at')->nullable();
            $table->unsignedBigInteger('resolved_by')->nullable();
            $table->timestamps();
        });

        Schema::create('publishing_records', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('post_request_id')->nullable();
            $table->unsignedBigInteger('published_by')->nullable();
            $table->string('platform')->default('facebook');
            $table->string('external_post_id')->nullable();
            $table->string('external_url')->nullable();
            $table->string('status')->default('scheduled');
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->text('error_message')->nullable();
            $table->json('platform_response')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('event_type')->nullable();
            $table->string('action')->nullable();
            $table->text('description')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('device')->nullable();
            $table->string('user_agent')->nullable();
            $table->string('severity')->nullable();
            $table->json('payload')->nullable();
            $table->json('details')->nullable();
            $table->timestamps();
        });

        Role::firstOrCreate(['name' => 'it_admin', 'guard_name' => 'web', 'display_name' => 'IT Admin']);
        Role::firstOrCreate(['name' => 'requestor', 'guard_name' => 'web', 'display_name' => 'Requestor']);
        Role::firstOrCreate(['name' => 'it_publisher', 'guard_name' => 'web', 'display_name' => 'IT Publisher']);
    }

    private function createTestUser(string $role = 'requestor'): User
    {
        $user = User::create([
            'employee_id' => 'EMP-' . uniqid(),
            'first_name' => 'Test',
            'middle_name' => null,
            'last_name' => ucfirst($role),
            'email' => "{$role}_" . uniqid() . '@jmc.edu.ph',
            'password' => Hash::make('password123'),
            'status' => 'active',
            'department' => 'IT Office',
            'position' => 'Staff',
        ]);
        $user->assignRole($role);
        return $user;
    }

    // =========================================================================
    // 1. PUBLIC & AUTH ROUTES
    // =========================================================================

    public function test_health_check_endpoint_returns_success(): void
    {
        $response = $this->getJson('/api/health');
        $response->assertStatus(200);
        $this->assertEquals('healthy', $response->json('status'));
    }

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

    public function test_register_validation_rejects_empty_payload(): void
    {
        $response = $this->postJson('/api/auth/register', []);
        $response->assertStatus(422);
    }

    public function test_authenticated_user_can_fetch_own_profile(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        // Test both /api/auth/user and /api/user
        $response1 = $this->getJson('/api/auth/user');
        $response1->assertStatus(200);
        $this->assertEquals($user->email, $response1->json('user.email'));

        $response2 = $this->getJson('/api/user');
        $response2->assertStatus(200);
        $this->assertEquals($user->email, $response2->json('email'));
    }

    public function test_authenticated_user_can_update_profile(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->putJson('/api/auth/profile', [
            'first_name' => 'UpdatedFirst',
            'last_name' => 'UpdatedLast',
            'phone' => '09123456789',
        ]);

        $response->assertStatus(200);
        $this->assertEquals('UpdatedFirst', $user->fresh()->first_name);
    }

    public function test_authenticated_user_can_update_password_with_correct_current_password(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->putJson('/api/auth/password', [
            'current_password' => 'password123',
            'new_password' => 'newpassword456',
            'new_password_confirmation' => 'newpassword456',
        ]);

        $response->assertStatus(200);
        $this->assertTrue(Hash::check('newpassword456', $user->fresh()->password));
    }

    public function test_profile_photo_route_returns_proper_response_when_no_photo(): void
    {
        $user = $this->createTestUser('requestor');
        $response = $this->getJson("/api/profile-photo/{$user->id}");
        $this->assertContains($response->status(), [200, 404]);
    }

    // =========================================================================
    // 2. ROLE-BASED ACCESS CONTROL (RBAC)
    // =========================================================================

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

    public function test_requestor_cannot_access_email_settings(): void
    {
        $requestor = $this->createTestUser('requestor');
        Sanctum::actingAs($requestor);

        $response = $this->getJson('/api/email-settings');
        $response->assertStatus(403);
    }

    public function test_requestor_cannot_access_api_tokens(): void
    {
        $requestor = $this->createTestUser('requestor');
        Sanctum::actingAs($requestor);

        $response = $this->getJson('/api/api-tokens');
        $response->assertStatus(403);
    }

    // =========================================================================
    // 3. ADMIN USER MANAGEMENT
    // =========================================================================

    public function test_admin_can_access_user_list(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/users');
        $response->assertStatus(200);
    }

    public function test_admin_can_access_user_roles(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/users/roles');
        $response->assertStatus(200);
    }

    public function test_admin_can_create_user(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $newUserEmail = 'newuser_' . uniqid() . '@jmc.edu.ph';
        $response = $this->postJson('/api/users', [
            'employee_id' => 'EMP-' . rand(1000, 9999),
            'first_name' => 'Alice',
            'last_name' => 'Smith',
            'email' => $newUserEmail,
            'password' => 'secret123',
            'role' => 'requestor',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('users', ['email' => $newUserEmail]);
    }

    public function test_admin_can_view_single_user(): void
    {
        $admin = $this->createTestUser('it_admin');
        $targetUser = $this->createTestUser('requestor');
        Sanctum::actingAs($admin);

        $response = $this->getJson("/api/users/{$targetUser->id}");
        $response->assertStatus(200)
                 ->assertJsonPath('data.email', $targetUser->email);
    }

    public function test_admin_can_update_user(): void
    {
        $admin = $this->createTestUser('it_admin');
        $targetUser = $this->createTestUser('requestor');
        Sanctum::actingAs($admin);

        $response = $this->putJson("/api/users/{$targetUser->id}", [
            'first_name' => 'UpdatedAlice',
            'last_name' => $targetUser->last_name,
            'email' => $targetUser->email,
            'role' => 'requestor',
        ]);

        $response->assertStatus(200);
        $this->assertEquals('UpdatedAlice', $targetUser->fresh()->first_name);
    }

    public function test_admin_can_delete_user(): void
    {
        $admin = $this->createTestUser('it_admin');
        $targetUser = $this->createTestUser('requestor');
        Sanctum::actingAs($admin);

        $response = $this->deleteJson("/api/users/{$targetUser->id}");
        $this->assertContains($response->status(), [200, 204]);
        $this->assertDatabaseMissing('users', ['id' => $targetUser->id]);
    }

    // =========================================================================
    // 4. CATEGORIES, DEPARTMENTS & ROLES
    // =========================================================================

    public function test_authenticated_user_can_fetch_categories(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        PostCategory::firstOrCreate(['name' => 'Campus News', 'slug' => 'campus-news']);

        $response = $this->getJson('/api/categories');
        $response->assertStatus(200);
    }

    public function test_authenticated_user_can_fetch_departments(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        Department::firstOrCreate(['name' => 'ccs', 'display_name' => 'College of Computer Studies']);

        $response = $this->getJson('/api/departments');
        $response->assertStatus(200);
    }

    public function test_admin_can_create_update_and_delete_department(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        // Create
        $response = $this->postJson('/api/departments', [
            'name' => 'cba',
            'display_name' => 'College of Business Administration',
            'description' => 'Business department',
        ]);
        $response->assertStatus(201);
        $deptId = $response->json('data.id');

        // Update
        $updateResponse = $this->putJson("/api/departments/{$deptId}", [
            'display_name' => 'College of Business and Accountancy',
        ]);
        $updateResponse->assertStatus(200);

        // Delete
        $deleteResponse = $this->deleteJson("/api/departments/{$deptId}");
        $this->assertContains($deleteResponse->status(), [200, 204]);
    }

    public function test_authenticated_user_can_fetch_roles_list(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/roles/list');
        $response->assertStatus(200);
    }

    public function test_roles_list_store_is_forbidden_as_roles_are_fixed(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/roles/list', ['name' => 'custom_role']);
        $response->assertStatus(403);
    }

    // =========================================================================
    // 5. POST REQUESTS CRUD & WORKFLOW
    // =========================================================================

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

    public function test_authenticated_user_can_fetch_posts_list(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/posts');
        $response->assertStatus(200);
    }

    public function test_authenticated_user_can_view_post_details(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $post = PostRequest::create([
            'title' => 'Test Post Details',
            'caption_narrative' => 'Detail body',
            'requestor_id' => $user->id,
            'status' => 'draft',
            'is_draft' => true,
        ]);

        $response = $this->getJson("/api/posts/{$post->id}");
        $response->assertStatus(200)
                 ->assertJsonPath('data.title', 'Test Post Details');
    }

    public function test_post_creator_can_update_draft_post(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $post = PostRequest::create([
            'title' => 'Original Title',
            'caption_narrative' => 'Original narrative',
            'requestor_id' => $user->id,
            'status' => 'draft',
            'is_draft' => true,
        ]);

        $response = $this->putJson("/api/posts/{$post->id}", [
            'title' => 'Updated Post Title',
            'caption_narrative' => 'Updated caption narrative',
            'is_draft' => true,
        ]);

        $response->assertStatus(200);
        $this->assertEquals('Updated Post Title', $post->fresh()->title);
    }

    public function test_post_creator_can_submit_post_for_approval(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $post = PostRequest::create([
            'title' => 'Post to Submit',
            'caption_narrative' => 'Ready for review',
            'requestor_id' => $user->id,
            'status' => 'draft',
            'is_draft' => false,
        ]);

        $response = $this->postJson("/api/posts/{$post->id}/submit");
        $this->assertContains($response->status(), [200, 201]);
    }

    public function test_admin_can_approve_post(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $post = PostRequest::create([
            'title' => 'Post for Approval',
            'caption_narrative' => 'Approve me',
            'requestor_id' => $admin->id,
            'status' => 'pending_office_head',
        ]);

        $response = $this->postJson("/api/posts/{$post->id}/approve", [
            'comments' => 'Looks good to approve',
        ]);

        $this->assertContains($response->status(), [200, 201]);
    }

    public function test_admin_can_reject_post(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $post = PostRequest::create([
            'title' => 'Post for Rejection',
            'caption_narrative' => 'Reject me',
            'requestor_id' => $admin->id,
            'status' => 'pending_office_head',
        ]);

        $response = $this->postJson("/api/posts/{$post->id}/reject", [
            'reason' => 'Inappropriate content',
        ]);

        $this->assertContains($response->status(), [200, 201]);
    }

    public function test_admin_can_return_post_for_revision(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $post = PostRequest::create([
            'title' => 'Post for Revision',
            'caption_narrative' => 'Needs changes',
            'requestor_id' => $admin->id,
            'status' => 'pending_office_head',
        ]);

        $response = $this->postJson("/api/posts/{$post->id}/return-revision", [
            'reason' => 'Please update the headline',
        ]);

        $this->assertContains($response->status(), [200, 201]);
    }

    public function test_post_deletion_succeeds_for_draft(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $post = PostRequest::create([
            'title' => 'Post to Delete',
            'caption_narrative' => 'Delete me',
            'requestor_id' => $user->id,
            'status' => 'draft',
            'is_draft' => true,
        ]);

        $response = $this->deleteJson("/api/posts/{$post->id}");
        $this->assertContains($response->status(), [200, 204]);
    }

    // =========================================================================
    // 6. DASHBOARD & ANALYTICS
    // =========================================================================

    public function test_post_dashboard_stats_endpoint(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/posts/dashboard/stats');
        $response->assertStatus(200);
    }

    public function test_dashboard_stats_endpoint(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/dashboard/stats');
        $response->assertStatus(200);
    }

    public function test_dashboard_init_endpoint(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/dashboard/init');
        $response->assertStatus(200);
    }

    public function test_dashboard_recent_activity_endpoint(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/dashboard/recent-activity');
        $response->assertStatus(200);
    }

    public function test_dashboard_violation_trends_endpoint(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/dashboard/violation-trends');
        $response->assertStatus(200);
    }

    public function test_admin_can_access_dashboard_analytics(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/dashboard/analytics');
        $response->assertStatus(200);
    }

    // =========================================================================
    // 7. NOTIFICATIONS
    // =========================================================================

    public function test_authenticated_user_can_fetch_notifications(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/notifications');
        $response->assertStatus(200);
    }

    public function test_authenticated_user_can_mark_all_notifications_read(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/notifications/read-all');
        $response->assertStatus(200);
    }

    // =========================================================================
    // 8. SETTINGS (AI, POLICY, TOKEN, EMAIL)
    // =========================================================================

    public function test_admin_can_access_ai_settings(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/ai-settings');
        $response->assertStatus(200)
                 ->assertJsonStructure(['provider', 'model', 'providers']);
    }

    public function test_admin_can_update_ai_settings(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/ai-settings', [
            'provider' => 'gemini',
            'api_key' => 'AIzaSyFakeKeyForTesting12345',
            'model' => 'gemini-2.0-flash',
        ]);

        $response->assertStatus(200);
    }

    public function test_admin_can_clear_ai_settings(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $response = $this->deleteJson('/api/ai-settings');
        $response->assertStatus(200);
    }

    public function test_authenticated_user_can_fetch_policy_settings(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/policy-settings');
        $response->assertStatus(200);
    }

    public function test_admin_can_update_policy_settings(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/policy-settings', [
            'effective_date' => '2026-01-01',
            'last_updated' => '2026-10-08',
            'sections' => [
                [
                    'id' => 'sec_1',
                    'title' => 'General Guidelines',
                    'rules' => ['Rule 1', 'Rule 2'],
                ]
            ],
        ]);

        $response->assertStatus(200);
    }

    public function test_admin_can_access_token_settings(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/token-settings');
        $response->assertStatus(200);
    }

    public function test_admin_can_update_token_settings(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/token-settings', [
            'facebook_page_id' => '61593431116189',
            'facebook_access_token' => 'EAAFakeTokenForTesting',
        ]);

        $response->assertStatus(200);
    }

    public function test_admin_can_access_email_settings(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/email-settings');
        $response->assertStatus(200);
    }

    public function test_admin_can_update_email_settings(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/email-settings', [
            'mail_mailer' => 'smtp',
            'mail_host' => 'smtp.gmail.com',
            'mail_port' => '587',
            'mail_username' => 'test@jmc.edu.ph',
            'mail_password' => 'secret123',
            'mail_encryption' => 'tls',
            'mail_from_address' => 'noreply@jmc.edu.ph',
            'mail_from_name' => 'JMC PostFlow',
        ]);

        $response->assertStatus(200);
    }

    public function test_admin_can_upload_and_delete_email_logo(): void
    {
        Storage::fake('public');
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $file = UploadedFile::fake()->image('logo.png', 100, 100);

        // Upload logo
        $response = $this->postJson('/api/email-settings/logo', [
            'logo' => $file,
        ]);
        $response->assertStatus(200);
        $this->assertNotEmpty($response->json('logo_url'));

        // Delete logo
        $deleteResponse = $this->deleteJson('/api/email-settings/logo');
        $deleteResponse->assertStatus(200);
    }

    // =========================================================================
    // 9. DEVELOPER API TOKENS & EXTERNAL
    // =========================================================================

    public function test_admin_can_list_api_tokens(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/api-tokens');
        $response->assertStatus(200);
    }

    public function test_admin_can_create_and_revoke_api_token(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        // Create token
        $response = $this->postJson('/api/api-tokens', [
            'name' => 'Test API Client',
        ]);
        $response->assertStatus(201);
        $tokenId = $response->json('data.id');

        // Revoke token
        $revokeResponse = $this->deleteJson("/api/api-tokens/{$tokenId}");
        $revokeResponse->assertStatus(200);
    }

    public function test_external_submit_request_rejects_missing_fields(): void
    {
        $user = $this->createTestUser('it_admin');
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/external/submit-request', []);
        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['title', 'caption_narrative']);
    }

    // =========================================================================
    // 10. CHATBOT, AUDIT LOGS & AI DRAFT CHECK
    // =========================================================================

    public function test_chatbot_message_requires_messages_array(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/chatbot/message', []);
        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['messages']);
    }

    public function test_draft_ai_check_requires_caption(): void
    {
        $user = $this->createTestUser('requestor');
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/posts/ai-check-draft', []);
        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['caption_narrative']);
    }

    public function test_admin_can_fetch_audit_logs(): void
    {
        $admin = $this->createTestUser('it_admin');
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/audit-logs');
        $response->assertStatus(200);
    }
}
