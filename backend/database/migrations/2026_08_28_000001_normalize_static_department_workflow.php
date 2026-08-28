<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->mergeDepartmentName(
            'Department of Information Technology',
            'Information Technology Office',
            ['admin']
        );

        $this->mergeDepartmentName(
            'Vice President for Academic Affairs',
            'Vice President of Academic Affairs',
            ['approver']
        );

        $this->ensureSystemDepartment('Information Technology Office', ['admin']);
        $this->ensureSystemDepartment('Institutional Marketing Communication', ['approver']);
        $this->ensureSystemDepartment('Vice President of Academic Affairs', ['approver']);

        DB::table('departments')
            ->whereIn('name', [
                'Information Technology Office',
                'Institutional Marketing Communication',
                'Vice President of Academic Affairs',
            ])
            ->update([
                'is_system' => true,
                'deleted_at' => null,
                'updated_at' => now(),
            ]);

        DB::table('departments')
            ->where('name', 'Information Technology Office')
            ->update(['role_categories' => json_encode(['admin'])]);

        DB::table('departments')
            ->whereIn('name', [
                'Institutional Marketing Communication',
                'Vice President of Academic Affairs',
            ])
            ->update(['role_categories' => json_encode(['approver'])]);

        DB::table('departments')
            ->where('is_system', false)
            ->update(['role_categories' => json_encode(['requestor', 'approver'])]);

        DB::table('users')
            ->where('department', 'Department of Information Technology')
            ->update(['department' => 'Information Technology Office']);

        DB::table('users')
            ->where('department', 'Vice President for Academic Affairs')
            ->update(['department' => 'Vice President of Academic Affairs']);
    }

    public function down(): void
    {
        DB::table('departments')
            ->where('name', 'Vice President of Academic Affairs')
            ->update([
                'name' => 'Vice President for Academic Affairs',
                'display_name' => 'Vice President for Academic Affairs',
                'role_categories' => json_encode(['approver']),
            ]);

        DB::table('users')
            ->where('department', 'Vice President of Academic Affairs')
            ->update(['department' => 'Vice President for Academic Affairs']);
    }

    private function mergeDepartmentName(string $legacyName, string $targetName, array $roleCategories): void
    {
        $legacy = DB::table('departments')->where('name', $legacyName)->first();
        if (!$legacy) {
            $legacy = DB::table('departments')->where('display_name', $legacyName)->first();
        }

        $target = DB::table('departments')->where('name', $targetName)->first();
        if (!$target) {
            $target = DB::table('departments')->where('display_name', $targetName)->first();
        }

        if ($legacy && $target && $legacy->id !== $target->id) {
            DB::table('departments')
                ->where('id', $legacy->id)
                ->update([
                    'deleted_at' => now(),
                    'updated_at' => now(),
                ]);
        } elseif ($legacy) {
            DB::table('departments')
                ->where('id', $legacy->id)
                ->update([
                    'name' => $targetName,
                    'display_name' => $targetName,
                    'is_system' => true,
                    'role_categories' => json_encode($roleCategories),
                    'updated_at' => now(),
                ]);
        }
    }

    private function ensureSystemDepartment(string $name, array $roleCategories): void
    {
        $exists = DB::table('departments')
            ->where('name', $name)
            ->orWhere('display_name', $name)
            ->exists();

        if ($exists) {
            return;
        }

        DB::table('departments')->insert([
            'name' => $name,
            'display_name' => $name,
            'description' => null,
            'is_active' => true,
            'is_system' => true,
            'role_categories' => json_encode($roleCategories),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
};
