<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class ResetUserDataCommand extends Command
{
    protected $signature = 'system:reset-user-data {--force : Force the operation to run without confirmation}';
    protected $description = 'Deletes all user accounts (except re-seeded Admin), posts, media, approval workflows, publishing records, and audit logs while preserving departments and system settings.';

    public function handle(): int
    {
        if (!$this->option('force') && !$this->confirm('Are you sure you want to delete all user accounts, posts, media, and logs?')) {
            $this->info('Operation cancelled.');
            return 0;
        }

        $this->info('Starting clean reset of user and post data...');

        // 1. Unlink any user associations from program heads without deleting department program head records
        if (Schema::hasTable('program_heads') && Schema::hasColumn('program_heads', 'user_id')) {
            DB::table('program_heads')->update(['user_id' => null]);
            $this->line('  - Unlinked user IDs from program heads (departments preserved).');
        }

        // 2. Child post activity tables
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
                $this->line("  - Cleared {$table}");
            }
        }

        Schema::enableForeignKeyConstraints();

        // 3. Clear file storage
        try {
            if (Storage::disk('public')->exists('photos')) {
                Storage::disk('public')->deleteDirectory('photos');
                $this->line('  - Cleared public photos directory.');
            }
            if (Storage::exists('temp')) {
                Storage::deleteDirectory('temp');
                $this->line('  - Cleared temp storage.');
            }
        } catch (\Throwable $e) {
            $this->warn('  - Note on storage cleanup: ' . $e->getMessage());
        }

        // 4. Create the pristine default System Administrator account
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

        $this->info("Successfully reset system! Admin account created: admin@jmc.edu.ph / {$adminPassword}");
        $this->info('Departments and System Settings (Facebook tokens, etc.) are intact.');

        return 0;
    }
}
