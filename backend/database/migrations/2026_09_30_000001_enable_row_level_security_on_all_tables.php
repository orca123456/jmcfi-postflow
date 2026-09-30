<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $tables = [
            'users',
            'roles',
            'permissions',
            'model_has_permissions',
            'model_has_roles',
            'role_has_permissions',
            'role_user',
            'departments',
            'post_categories',
            'target_platforms',
            'post_requests',
            'post_media',
            'post_media_files',
            'approval_workflows',
            'policy_violations',
            'publishing_records',
            'audit_logs',
            'notifications',
            'system_settings',
            'personal_access_tokens',
            'login_lockouts',
            'jobs',
            'failed_jobs',
            'cache',
            'cache_locks',
        ];

        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                try {
                    DB::statement("ALTER TABLE \"{$table}\" ENABLE ROW LEVEL SECURITY;");
                } catch (\Throwable $e) {
                    logger()->warning("Could not enable RLS on table {$table}: " . $e->getMessage());
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $tables = [
            'users',
            'roles',
            'permissions',
            'model_has_permissions',
            'model_has_roles',
            'role_has_permissions',
            'role_user',
            'departments',
            'post_categories',
            'target_platforms',
            'post_requests',
            'post_media',
            'post_media_files',
            'approval_workflows',
            'policy_violations',
            'publishing_records',
            'audit_logs',
            'notifications',
            'system_settings',
            'personal_access_tokens',
            'login_lockouts',
            'jobs',
            'failed_jobs',
            'cache',
            'cache_locks',
        ];

        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                try {
                    DB::statement("ALTER TABLE \"{$table}\" DISABLE ROW LEVEL SECURITY;");
                } catch (\Throwable $e) {
                    logger()->warning("Could not disable RLS on table {$table}: " . $e->getMessage());
                }
            }
        }
    }
};
