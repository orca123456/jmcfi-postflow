<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds performance indexes for the most common dashboard queries:
     * - status: used in GROUP BY, WHERE filters (stats, counts)
     * - requestor_id: used in role-based visibility and joins
     * - created_at: used in ORDER BY, monthly aggregation
     * - updated_at: used in ORDER BY (recent activity)
     * - Composite (status, created_at): for GROUP BY + time-range queries
     */
    public function up(): void
    {
        Schema::table('post_requests', function (Blueprint $table) {
            // Single-column indexes for frequent filters
            $table->index('status', 'idx_post_requests_status');
            $table->index('requestor_id', 'idx_post_requests_requestor_id');
            $table->index('created_at', 'idx_post_requests_created_at');
            $table->index('updated_at', 'idx_post_requests_updated_at');

            // Composite index for GROUP BY status + time-range queries
            $table->index(['status', 'created_at'], 'idx_post_requests_status_created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('post_requests', function (Blueprint $table) {
            $table->dropIndex('idx_post_requests_status');
            $table->dropIndex('idx_post_requests_requestor_id');
            $table->dropIndex('idx_post_requests_created_at');
            $table->dropIndex('idx_post_requests_updated_at');
            $table->dropIndex('idx_post_requests_status_created_at');
        });
    }
};
