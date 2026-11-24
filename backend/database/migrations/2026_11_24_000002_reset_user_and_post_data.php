<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Unlink any user associations from program heads without deleting department program head records
        if (Schema::hasTable('program_heads') && Schema::hasColumn('program_heads', 'user_id')) {
            DB::table('program_heads')->update(['user_id' => null]);
        }

        // 2. Child post activity and user tables to wipe clean
        $tables = [
            'publishing_records',
            'policy_violations',
            'ai_compliance_checks',
            'approval_workflows',
            'post_media_files',
            'post_media',
            'post_requests',
            'audit_logs',
            'notifications',
            'personal_access_tokens',
            'sessions',
            'password_reset_tokens',
            'login_lockouts',
            'failed_jobs',
            'jobs',
            'model_has_roles',
            'model_has_permissions',
            'role_user',
            'users',
        ];

        Schema::disableForeignKeyConstraints();

        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->delete();
            }
        }

        Schema::enableForeignKeyConstraints();

        // 3. Clear file storage if accessible
        try {
            if (Storage::disk('public')->exists('photos')) {
                Storage::disk('public')->deleteDirectory('photos');
            }
            if (Storage::exists('temp')) {
                Storage::deleteDirectory('temp');
            }
        } catch (\Throwable) {
            // Non-fatal disk cleanup
        }

        // 4. Ensure pristine System Administrator account exists so admin is never locked out
        $adminPassword = env('SEED_ADMIN_PASSWORD') ?: 'password123';
        $admin = User::create([
            'employee_id' => 'JMCFI-ADMIN-001',
            'first_name' => 'System',
            'middle_name' => '',
            'last_name' => 'Administrator',
            'email' => 'admin@jmc.edu.ph',
            'password' => Hash::make($adminPassword),
            'phone' => '+639000000001',
            'department' => 'Information Technology Office',
            'position' => 'System Administrator',
            'status' => 'active',
        ]);

        $admin->syncRoles(['it_admin', 'it_publisher']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
