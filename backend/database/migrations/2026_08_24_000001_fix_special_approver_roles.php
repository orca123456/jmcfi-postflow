<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->moveOfficeHeadUsersToSpecialRole(
            ['Vice President for Academic Affairs', 'Vice President of Academic Affairs'],
            'vice_president',
            'Vice President'
        );

        $this->moveOfficeHeadUsersToSpecialRole(
            ['Institutional Marketing Communication'],
            'imc_qa_checker',
            'QA / Branding Checker'
        );
    }

    public function down(): void
    {
        $this->moveSpecialRoleUsersToOfficeHead(
            ['Vice President for Academic Affairs', 'Vice President of Academic Affairs'],
            'vice_president',
            'Department Head'
        );

        $this->moveSpecialRoleUsersToOfficeHead(
            ['Institutional Marketing Communication'],
            'imc_qa_checker',
            'Department Head'
        );
    }

    private function moveOfficeHeadUsersToSpecialRole(array $departments, string $specialRole, string $position): void
    {
        $officeHeadRoleId = DB::table('roles')->where('name', 'office_head')->value('id');
        $specialRoleId = DB::table('roles')->where('name', $specialRole)->value('id');

        if (!$officeHeadRoleId || !$specialRoleId) {
            return;
        }

        $userIds = DB::table('users')
            ->join('model_has_roles', 'users.id', '=', 'model_has_roles.model_id')
            ->where('model_has_roles.model_type', User::class)
            ->where('model_has_roles.role_id', $officeHeadRoleId)
            ->whereIn('users.department', $departments)
            ->pluck('users.id');

        foreach ($userIds as $userId) {
            DB::table('model_has_roles')->where([
                'role_id' => $officeHeadRoleId,
                'model_type' => User::class,
                'model_id' => $userId,
            ])->delete();

            DB::table('model_has_roles')->insertOrIgnore([
                'role_id' => $specialRoleId,
                'model_type' => User::class,
                'model_id' => $userId,
            ]);
        }

        DB::table('users')->whereIn('id', $userIds)->update(['position' => $position]);
    }

    private function moveSpecialRoleUsersToOfficeHead(array $departments, string $specialRole, string $position): void
    {
        $officeHeadRoleId = DB::table('roles')->where('name', 'office_head')->value('id');
        $specialRoleId = DB::table('roles')->where('name', $specialRole)->value('id');

        if (!$officeHeadRoleId || !$specialRoleId) {
            return;
        }

        $userIds = DB::table('users')
            ->join('model_has_roles', 'users.id', '=', 'model_has_roles.model_id')
            ->where('model_has_roles.model_type', User::class)
            ->where('model_has_roles.role_id', $specialRoleId)
            ->whereIn('users.department', $departments)
            ->pluck('users.id');

        foreach ($userIds as $userId) {
            DB::table('model_has_roles')->where([
                'role_id' => $specialRoleId,
                'model_type' => User::class,
                'model_id' => $userId,
            ])->delete();

            DB::table('model_has_roles')->insertOrIgnore([
                'role_id' => $officeHeadRoleId,
                'model_type' => User::class,
                'model_id' => $userId,
            ]);
        }

        DB::table('users')->whereIn('id', $userIds)->update(['position' => $position]);
    }
};
