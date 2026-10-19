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
        // Update any existing user position with 'Staff / Faculty' to 'Requestor'
        DB::table('users')
            ->where(function ($query) {
                $query->where('position', 'Staff / Faculty')
                      ->orWhere('position', 'like', '%Staff%')
                      ->orWhere('position', 'like', '%Faculty%');
            })
            ->update(['position' => 'Requestor']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No reverse operation needed
    }
};
