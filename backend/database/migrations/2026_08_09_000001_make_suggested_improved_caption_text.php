<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The AI-generated improved caption routinely exceeds 255 characters,
     * which caused SQLSTATE[22001] (value too long for varchar(255)) and
     * silently broke the AI compliance check. Widen it to text.
     */
    public function up(): void
    {
        Schema::table('ai_compliance_checks', function (Blueprint $table) {
            $table->text('suggested_improved_caption')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('ai_compliance_checks', function (Blueprint $table) {
            $table->string('suggested_improved_caption')->nullable()->change();
        });
    }
};
