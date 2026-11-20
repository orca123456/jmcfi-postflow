<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('post_requests', 'submitted_materials')) {
            Schema::table('post_requests', function (Blueprint $table) {
                $table->json('submitted_materials')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('post_requests', 'submitted_materials')) {
            Schema::table('post_requests', function (Blueprint $table) {
                $table->dropColumn('submitted_materials');
            });
        }
    }
};
