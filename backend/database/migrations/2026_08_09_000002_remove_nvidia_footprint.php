<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Clean up the leftover NVIDIA API footprint from the live database.
 * The application now uses DeepSeek for AI content compliance checking.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Point the column default at DeepSeek instead of NVIDIA
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE ai_compliance_checks ALTER COLUMN model_used SET DEFAULT 'deepseek-chat'");
        }

        // Update the legacy ai_model system setting row (unused by the service,
        // kept only for consistency with the seeder source)
        DB::table('system_settings')
            ->where('key', 'ai_model')
            ->update([
                'value' => 'deepseek-chat',
                'description' => 'DeepSeek AI model for content compliance checking',
            ]);
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE ai_compliance_checks ALTER COLUMN model_used SET DEFAULT 'nvidia/nemotron-3-ultra-550b-a55b'");
        }

        DB::table('system_settings')
            ->where('key', 'ai_model')
            ->update([
                'value' => 'nvidia/nemotron-3-ultra-550b-a55b',
                'description' => 'NVIDIA AI model for content compliance checking',
            ]);
    }
};
