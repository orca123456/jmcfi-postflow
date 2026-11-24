<?php

use App\Services\ExcelTemplateService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        try {
            ExcelTemplateService::generateTemplate(null, true);
        } catch (\Throwable $e) {
            Log::warning('Could not regenerate excel template during migration: ' . $e->getMessage());
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
