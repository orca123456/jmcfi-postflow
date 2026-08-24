<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('post_requests', function (Blueprint $table) {
            $table->index(['status', 'department_id', 'created_at'], 'idx_pr_status_department_created_dashboard');
        });
    }

    public function down(): void
    {
        Schema::table('post_requests', function (Blueprint $table) {
            $table->dropIndex('idx_pr_status_department_created_dashboard');
        });
    }
};
