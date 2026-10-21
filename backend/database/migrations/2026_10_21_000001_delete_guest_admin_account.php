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
        // Finding F4: Remove unauthorized guest admin account from production
        $guest = DB::table('users')->where('email', 'postflow.guest@jmc.edu.ph')->first();
        if ($guest) {
            // Delete personal access tokens associated with this guest account
            DB::table('personal_access_tokens')
                ->where('tokenable_type', 'App\\Models\\User')
                ->where('tokenable_id', $guest->id)
                ->delete();

            // Delete user
            DB::table('users')->where('id', $guest->id)->delete();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op
    }
};
