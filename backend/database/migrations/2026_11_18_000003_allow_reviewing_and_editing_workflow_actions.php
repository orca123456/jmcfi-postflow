<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('approval_workflows', function (Blueprint $table) {
                $table->string('action')->default('pending')->change();
            });
            return;
        }

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE approval_workflows DROP CONSTRAINT IF EXISTS approval_workflows_action_check');
        DB::statement("ALTER TABLE approval_workflows ADD CONSTRAINT approval_workflows_action_check CHECK (action::text = ANY (ARRAY[
            'pending'::character varying,
            'reviewing'::character varying,
            'editing'::character varying,
            'approved'::character varying,
            'rejected'::character varying,
            'returned_for_revision'::character varying
        ]::text[]))");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE approval_workflows DROP CONSTRAINT IF EXISTS approval_workflows_action_check');
        DB::statement("ALTER TABLE approval_workflows ADD CONSTRAINT approval_workflows_action_check CHECK (action::text = ANY (ARRAY[
            'pending'::character varying,
            'approved'::character varying,
            'rejected'::character varying,
            'returned_for_revision'::character varying
        ]::text[]))");
    }
};
