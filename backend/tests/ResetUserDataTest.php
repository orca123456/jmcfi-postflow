<?php

namespace Tests;

use App\Models\Department;
use App\Models\PostRequest;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ResetUserDataTest extends TestCase
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
            $table->timestamps();
        });

        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('display_name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->longText('value')->nullable();
            $table->string('group')->default('general');
            $table->timestamps();
        });

        Schema::create('post_requests', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->longText('caption_narrative')->nullable();
            $table->unsignedBigInteger('requestor_id');
            $table->string('status')->default('draft');
            $table->timestamps();
        });

        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('guard_name')->default('web');
            $table->timestamps();
        });

        Schema::create('model_has_roles', function (Blueprint $table) {
            $table->unsignedBigInteger('role_id');
            $table->string('model_type');
            $table->unsignedBigInteger('model_id');
            $table->primary(['role_id', 'model_id', 'model_type']);
        });

        Role::create(['name' => 'it_admin', 'guard_name' => 'web']);
        Role::create(['name' => 'it_publisher', 'guard_name' => 'web']);
    }

    public function test_reset_user_data_wipes_posts_and_custom_users_while_keeping_departments_and_settings(): void
    {
        // 1. Create department (institutional data)
        Department::create([
            'name' => 'IT_OFFICE',
            'display_name' => 'Information Technology Office',
            'is_active' => true,
        ]);

        // 2. Create system setting (platform tokens)
        SystemSetting::create([
            'key' => 'facebook_access_token',
            'value' => 'EAAC123456TESTTOKEN',
            'group' => 'platforms',
        ]);

        // 3. Create a test user and post
        $testUser = User::create([
            'employee_id' => 'JMCFI-TEST-999',
            'first_name' => 'Old',
            'last_name' => 'User',
            'email' => 'olduser@jmc.edu.ph',
            'password' => bcrypt('password'),
        ]);

        PostRequest::create([
            'title' => 'Test Post To Delete',
            'slug' => 'test-post-to-delete',
            'caption_narrative' => 'Old content',
            'requestor_id' => $testUser->id,
            'status' => 'draft',
        ]);

        $this->assertEquals(1, PostRequest::count());
        $this->assertEquals(1, User::where('email', 'olduser@jmc.edu.ph')->count());

        // 4. Run reset command
        $exitCode = Artisan::call('system:reset-user-data', ['--force' => true]);
        $this->assertEquals(0, $exitCode);

        // 5. Assert: Posts and old user are gone
        $this->assertEquals(0, PostRequest::count());
        $this->assertEquals(0, User::where('email', 'olduser@jmc.edu.ph')->count());

        // 6. Assert: Clean Admin exists
        $admin = User::where('email', 'admin@jmc.edu.ph')->first();
        $this->assertNotNull($admin);
        $this->assertTrue($admin->hasRole('it_admin'));

        // 7. Assert: Departments and System Settings are untouched
        $this->assertEquals(1, Department::where('name', 'IT_OFFICE')->count());
        $this->assertEquals('EAAC123456TESTTOKEN', SystemSetting::where('key', 'facebook_access_token')->first()->value);
    }
}
