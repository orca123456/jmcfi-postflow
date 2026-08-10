<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add role-scoping to departments so each role (admin/approver/requestor)
     * has its OWN department pool. Add/Delete in one role no longer affects
     * another role's departments.
     */
    public function up(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->json('role_categories')->nullable()->after('is_active');
        });

        // Backfill existing departments with the role categories they were
        // implicitly designated for by the old name-based filtering:
        //   admin    -> ICT
        //   approver -> IMC, Office of the President
        //   both     -> colleges / shared offices
        DB::table('departments')->where('name', 'ict')
            ->update(['role_categories' => json_encode(['admin'])]);

        DB::table('departments')->whereIn('name', ['imc', 'office_of_the_president'])
            ->update(['role_categories' => json_encode(['approver'])]);

        DB::table('departments')->whereIn('name', [
            'marketing',
            'academic_affairs',
            'administration',
            'bs-information_technology',
            'college_of_business_education',
        ])->update(['role_categories' => json_encode(['requestor', 'approver'])]);

        // Any department not matched above gets an empty list.
        DB::table('departments')->whereNull('role_categories')
            ->update(['role_categories' => json_encode([])]);
    }

    public function down(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->dropColumn('role_categories');
        });
    }
};
