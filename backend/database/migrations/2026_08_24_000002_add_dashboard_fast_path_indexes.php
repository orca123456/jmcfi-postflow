<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->index('department', 'idx_users_department_dashboard');
        });

        Schema::table('approval_workflows', function (Blueprint $table) {
            $table->index(['post_request_id', 'action', 'stage_order'], 'idx_aw_post_action_order_dashboard');
            $table->index(['stage', 'action'], 'idx_aw_stage_action_dashboard');
        });
    }

    public function down(): void
    {
        Schema::table('approval_workflows', function (Blueprint $table) {
            $table->dropIndex('idx_aw_stage_action_dashboard');
            $table->dropIndex('idx_aw_post_action_order_dashboard');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('idx_users_department_dashboard');
        });
    }
};
