<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $setting = DB::table('system_settings')->where('key', 'policy_sections')->first();
        if ($setting && !empty($setting->value)) {
            $updated = str_replace('jcm.edu.ph', 'jmc.edu.ph', $setting->value);
            $updated = preg_replace('/\bJCMFI\b/', 'JMCFI', $updated);
            $updated = preg_replace('/\bJCM\b/', 'JMC', $updated);
            DB::table('system_settings')->where('key', 'policy_sections')->update(['value' => $updated]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Irreversible correction
    }
};
