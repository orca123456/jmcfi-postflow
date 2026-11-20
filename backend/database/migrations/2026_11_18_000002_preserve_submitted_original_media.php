<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('post_media', 'is_submission_original')) {
            Schema::table('post_media', function (Blueprint $table) {
                $table->boolean('is_submission_original')->default(false);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('post_media', 'is_submission_original')) {
            Schema::table('post_media', function (Blueprint $table) {
                $table->dropColumn('is_submission_original');
            });
        }
    }
};
