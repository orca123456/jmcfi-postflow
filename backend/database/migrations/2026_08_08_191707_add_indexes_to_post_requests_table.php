<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('post_requests', function (Blueprint $table) {
            $table->index('status');
            $table->index('requestor_id');
            $table->index('department_id');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('post_requests', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropIndex(['requestor_id']);
            $table->dropIndex(['department_id']);
            $table->dropIndex(['created_at']);
        });
    }
};
