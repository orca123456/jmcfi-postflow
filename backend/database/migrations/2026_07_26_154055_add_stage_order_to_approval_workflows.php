<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('approval_workflows', function (Blueprint $table) {
            $table->integer('stage_order')->nullable()->after('action');
        });
    }

    public function down(): void
    {
        Schema::table('approval_workflows', function (Blueprint $table) {
            $table->dropColumn('stage_order');
        });
    }
};
