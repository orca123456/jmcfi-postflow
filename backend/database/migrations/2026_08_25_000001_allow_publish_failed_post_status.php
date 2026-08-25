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
            Schema::table('post_requests', function (Blueprint $table) {
                $table->string('status')->default('draft')->change();
            });
            return;
        }

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE post_requests DROP CONSTRAINT IF EXISTS post_requests_status_check');
        DB::statement("ALTER TABLE post_requests ADD CONSTRAINT post_requests_status_check CHECK (status::text = ANY (ARRAY[
            'draft'::character varying,
            'pending_office_head'::character varying,
            'pending_vice_president'::character varying,
            'pending_president'::character varying,
            'pending_imc_qa'::character varying,
            'approved'::character varying,
            'rejected'::character varying,
            'returned_for_revision'::character varying,
            'scheduled'::character varying,
            'published'::character varying,
            'publish_failed'::character varying,
            'archived'::character varying
        ]::text[]))");
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE post_requests DROP CONSTRAINT IF EXISTS post_requests_status_check');
        DB::statement("ALTER TABLE post_requests ADD CONSTRAINT post_requests_status_check CHECK (status::text = ANY (ARRAY[
            'draft'::character varying,
            'pending_office_head'::character varying,
            'pending_vice_president'::character varying,
            'pending_president'::character varying,
            'pending_imc_qa'::character varying,
            'approved'::character varying,
            'rejected'::character varying,
            'returned_for_revision'::character varying,
            'scheduled'::character varying,
            'published'::character varying,
            'archived'::character varying
        ]::text[]))");
    }
};
