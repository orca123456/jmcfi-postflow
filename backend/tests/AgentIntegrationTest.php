<?php

namespace Tests;

use App\Http\Controllers\Api\AgentIntegrationController;
use App\Models\AuditLog;
use App\Models\Department;
use App\Models\PostCategory;
use App\Models\PostRequest;
use App\Models\Role;
use App\Models\SystemSetting;
use App\Models\User;
use App\Services\SystemAlertService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\TestCase;

final class AgentIntegrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $app = require __DIR__ . '/../bootstrap/app.php';
        $app->make(Kernel::class)->bootstrap();
        restore_error_handler();
        restore_exception_handler();
        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
            'cache.default' => 'array',
        ]);
        app('db')->purge('sqlite');

        // Setup in-memory SQLite schema for testing
        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->string('type')->default('string');
            $table->text('description')->nullable();
            $table->boolean('is_public')->default(false);
            $table->timestamps();
        });

        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('guard_name')->default('web');
            $table->string('display_name')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('model_has_roles', function (Blueprint $table) {
            $table->foreignId('role_id');
            $table->string('model_type');
            $table->foreignId('model_id');
            $table->primary(['role_id', 'model_id', 'model_type']);
        });

        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('display_name')->nullable();
            $table->string('description')->nullable();
            $table->string('logo_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_system')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('employee_id')->nullable();
            $table->string('first_name');
            $table->string('middle_name')->nullable();
            $table->string('last_name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('phone')->nullable();
            $table->string('department')->nullable();
            $table->foreignId('program_head_id')->nullable();
            $table->string('position')->nullable();
            $table->string('status')->default('active');
            $table->string('photo_path')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->foreignId('department_id')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('user_roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id');
            $table->foreignId('role_id');
            $table->timestamps();
        });

        Schema::create('post_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('post_requests', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug');
            $table->text('caption_narrative');
            $table->foreignId('category_id')->nullable();
            $table->foreignId('department_id')->nullable();
            $table->foreignId('requestor_id')->nullable();
            $table->string('status')->default('draft');
            $table->text('target_platforms')->nullable();
            $table->integer('revision_count')->default(0);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('post_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_request_id');
            $table->string('file_name');
            $table->string('file_path');
            $table->string('file_type');
            $table->integer('file_size');
            $table->boolean('is_featured')->default(false);
            $table->timestamps();
        });

        Schema::create('approval_workflows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_request_id');
            $table->foreignId('approver_id')->nullable();
            $table->string('stage');
            $table->integer('stage_order')->default(1);
            $table->string('action')->default('pending');
            $table->text('comments')->nullable();
            $table->timestamp('action_date')->nullable();
            $table->timestamps();
        });

        Schema::create('publishing_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_request_id');
            $table->foreignId('published_by')->nullable();
            $table->string('platform');
            $table->string('external_post_id')->nullable();
            $table->text('external_url')->nullable();
            $table->string('status');
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->text('error_message')->nullable();
            $table->text('platform_response')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable();
            $table->string('event_type');
            $table->text('description');
            $table->string('ip_address')->nullable();
            $table->string('device')->nullable();
            $table->string('severity')->default('INFO');
            $table->text('payload')->nullable();
            $table->timestamps();
        });

        Log::spy();
        Http::preventStrayRequests();
    }

    public function test_telegram_alert_dispatches_proper_request(): void
    {
        SystemSetting::create(['key' => 'telegram_bot_token', 'value' => 'test-token-12345']);
        SystemSetting::create(['key' => 'telegram_chat_id', 'value' => '987654321']);

        Http::fake([
            'https://api.telegram.org/bottest-token-12345/sendMessage' => Http::response(['ok' => true], 200),
        ]);

        SystemAlertService::alertSecurity(
            'BRUTE_FORCE_LOCKOUT',
            'Multiple failed attempts detected from IP 192.168.1.100',
            '192.168.1.100',
            ['attempts' => 5]
        );

        Http::assertSent(function ($request) {
            return str_contains($request->url(), 'sendMessage')
                && $request['chat_id'] === '987654321'
                && str_contains($request['text'], 'BRUTE_FORCE_LOCKOUT')
                && str_contains($request['text'], '192.168.1.100');
        });
    }

    public function test_webhook_alert_dispatches_json_payload(): void
    {
        SystemSetting::create(['key' => 'alert_webhook_url', 'value' => 'https://webhook.site/test-alert-receiver']);

        Http::fake([
            'https://webhook.site/test-alert-receiver' => Http::response(['status' => 'received'], 200),
        ]);

        SystemAlertService::alertError(
            'DatabaseDeadlockException',
            'Transaction aborted due to lock timeout',
            ['table' => 'post_requests']
        );

        Http::assertSent(function ($request) {
            return $request->url() === 'https://webhook.site/test-alert-receiver'
                && $request['severity'] === 'ERROR'
                && str_contains($request['description'], 'Transaction aborted');
        });
    }

    public function test_agent_openapi_spec_structure(): void
    {
        $controller = new AgentIntegrationController();
        $response = $controller->openApi();
        $data = $response->getData(true);

        $this->assertEquals('3.0.3', $data['openapi']);
        $this->assertEquals('JMCFI PostFlow Agent API', $data['info']['title']);
        $this->assertArrayHasKey('BearerAuth', $data['components']['securitySchemes']);
        $this->assertArrayHasKey('/agent/posts', $data['paths']);
        $this->assertArrayHasKey('/agent/posts/{id}', $data['paths']);
        $this->assertArrayHasKey('/agent/security-alerts', $data['paths']);
        $this->assertArrayHasKey('/agent/system-health', $data['paths']);
    }

    public function test_agent_can_create_post_and_list_posts(): void
    {
        $cat = PostCategory::create(['name' => 'Announcements', 'is_active' => true]);
        $dept = Department::create(['name' => 'IT Dept', 'display_name' => 'IT']);
        $user = User::create([
            'first_name' => 'Admin',
            'last_name' => 'User',
            'email' => 'admin@jmc.edu.ph',
            'password' => bcrypt('secret'),
            'department' => 'IT Dept',
        ]);

        $controller = new AgentIntegrationController();

        // 1. Create post
        $req = Request::create('/api/agent/posts', 'POST', [
            'title' => 'Important Campus Notice',
            'caption_narrative' => 'Classes will be online tomorrow.',
            'category_id' => $cat->id,
            'target_platforms' => ['facebook'],
            'bypass_approval' => false,
        ]);
        $req->setUserResolver(fn() => $user);

        $createResponse = $controller->store($req);
        $this->assertEquals(201, $createResponse->getStatusCode());
        $createdData = $createResponse->getData(true);
        $postId = $createdData['data']['post']['id'];
        $this->assertNotEmpty($postId);

        // 2. Read post
        $showResponse = $controller->show($postId);
        $this->assertEquals(200, $showResponse->getStatusCode());
        $showData = $showResponse->getData(true);
        $this->assertEquals('Important Campus Notice', $showData['data']['title']);

        // 3. Update post
        $updateReq = Request::create("/api/agent/posts/{$postId}", 'PUT', [
            'title' => 'Updated Campus Notice',
        ]);
        $updateReq->setUserResolver(fn() => $user);
        $updateResponse = $controller->update($updateReq, $postId);
        $this->assertEquals(200, $updateResponse->getStatusCode());
        $this->assertEquals('Updated Campus Notice', PostRequest::find($postId)->title);

        // 4. List posts
        $listReq = Request::create('/api/agent/posts', 'GET', ['search' => 'Campus']);
        $listResponse = $controller->index($listReq);
        $listData = $listResponse->getData(true);
        $this->assertEquals(1, count($listData['data']));

        // 5. Delete post
        $deleteResponse = $controller->destroy($postId);
        $this->assertEquals(200, $deleteResponse->getStatusCode());
        $this->assertNull(PostRequest::find($postId));
    }

    public function test_non_admin_cannot_bypass_approval_workflow(): void
    {
        $cat = PostCategory::create(['name' => 'Campus News', 'is_active' => true]);
        $user = User::create([
            'first_name' => 'Regular',
            'last_name' => 'User',
            'email' => 'regular@jmc.edu.ph',
            'password' => bcrypt('secret'),
        ]);

        $controller = new AgentIntegrationController();

        $req = Request::create('/api/agent/posts', 'POST', [
            'title' => 'Unauthorized Direct Publish Attempt',
            'caption_narrative' => 'Trying to bypass without admin role.',
            'category_id' => $cat->id,
            'bypass_approval' => true,
        ]);
        $req->setUserResolver(fn() => $user);

        $response = $controller->store($req);
        $this->assertEquals(403, $response->getStatusCode());
    }

    public function test_agent_security_alerts_and_health_endpoints(): void
    {
        AuditLog::create([
            'event_type' => 'LOGIN_LOCKED',
            'description' => 'Blocked attacker brute force attempt',
            'severity' => 'WARNING',
            'ip_address' => '203.0.113.42',
        ]);

        $controller = new AgentIntegrationController();

        // Security alerts endpoint
        $alertsReq = Request::create('/api/agent/security-alerts', 'GET', ['limit' => 5]);
        $alertsResponse = $controller->securityAlerts($alertsReq);
        $this->assertEquals(200, $alertsResponse->getStatusCode());
        $alertsData = $alertsResponse->getData(true);
        $this->assertGreaterThanOrEqual(1, $alertsData['count']);
        $this->assertEquals('LOGIN_LOCKED', $alertsData['data'][0]['event_type']);

        // System health endpoint
        $healthResponse = $controller->systemHealth();
        $this->assertEquals(200, $healthResponse->getStatusCode());
        $healthData = $healthResponse->getData(true);
        $this->assertEquals('healthy', $healthData['status']);
        $this->assertArrayHasKey('platforms', $healthData);
    }
}
