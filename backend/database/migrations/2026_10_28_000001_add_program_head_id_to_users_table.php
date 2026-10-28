<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use App\Models\ProgramHead;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'program_head_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->foreignId('program_head_id')->nullable()->after('department')->constrained('program_heads')->nullOnDelete();
            });
        }

        // Backfill existing program heads' user_id into users.program_head_id
        if (Schema::hasTable('program_heads') && Schema::hasColumn('users', 'program_head_id')) {
            $heads = ProgramHead::whereNotNull('user_id')->get();
            foreach ($heads as $head) {
                DB::table('users')->where('id', $head->user_id)->update(['program_head_id' => $head->id]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('users', 'program_head_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropForeign(['program_head_id']);
                $table->dropColumn('program_head_id');
            });
        }
    }
};
