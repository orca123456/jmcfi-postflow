<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('post_requests', function (Blueprint $table) {
            if (!Schema::hasColumn('post_requests', 'routing_type')) {
                $table->string('routing_type')->default('standard')->after('status');
                $table->index('routing_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('post_requests', function (Blueprint $table) {
            if (Schema::hasColumn('post_requests', 'routing_type')) {
                $table->dropIndex(['routing_type']);
                $table->dropColumn('routing_type');
            }
        });
    }
};

