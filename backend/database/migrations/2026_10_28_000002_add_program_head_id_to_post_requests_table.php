<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('post_requests', 'program_head_id')) {
            Schema::table('post_requests', function (Blueprint $table) {
                $table->foreignId('program_head_id')->nullable()->after('requestor_id')->constrained('program_heads')->nullOnDelete();
            });
        }

        // Backfill existing post_requests from requestor's program_head_id
        if (Schema::hasColumn('post_requests', 'program_head_id') && Schema::hasColumn('users', 'program_head_id')) {
            $posts = DB::table('post_requests')->whereNull('program_head_id')->whereNotNull('requestor_id')->get();
            foreach ($posts as $post) {
                $user = DB::table('users')->where('id', $post->requestor_id)->first();
                if ($user && !empty($user->program_head_id)) {
                    DB::table('post_requests')->where('id', $post->id)->update(['program_head_id' => $user->program_head_id]);
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('post_requests', 'program_head_id')) {
            Schema::table('post_requests', function (Blueprint $table) {
                $table->dropForeign(['program_head_id']);
                $table->dropColumn('program_head_id');
            });
        }
    }
};
