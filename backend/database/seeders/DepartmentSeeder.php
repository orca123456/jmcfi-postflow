<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Department;

class DepartmentSeeder extends Seeder
{
    public function run(): void
    {
        // ── Built-in system departments (cannot be removed) ─────────────
        // These are tied to specific approval roles in the workflow.
        $systemDepartments = [
            [
                'name' => 'Information Technology Office',
                'display_name' => 'Information Technology Office',
                'description' => 'IT Department — manages the system and publishes approved content.',
                'is_system' => true,
                'role_categories' => ['admin'],
            ],
            [
                'name' => 'Institutional Marketing Communication',
                'display_name' => 'Institutional Marketing Communication',
                'description' => 'IMC Department — performs final QA and branding checks.',
                'is_system' => true,
                'role_categories' => ['approver'],
            ],
            [
                'name' => 'Vice President for Academic Affairs',
                'display_name' => 'Vice President for Academic Affairs',
                'description' => 'VPAA Office — VP-level approval stage.',
                'is_system' => true,
                'role_categories' => ['approver'],
            ],
        ];

        foreach ($systemDepartments as $dept) {
            Department::updateOrCreate(
                ['name' => $dept['name']],
                $dept
            );
        }

        // Clean up legacy name if it exists (was "Vice President of Academic Affairs")
        $legacy = Department::where('name', 'Vice President of Academic Affairs')->first();
        if ($legacy) {
            // If the correct one already exists, just remove the old one
            if (Department::where('name', 'Vice President for Academic Affairs')->exists()) {
                $legacy->forceDelete();
            } else {
                $legacy->update([
                    'name' => 'Vice President for Academic Affairs',
                    'display_name' => 'Vice President for Academic Affairs',
                    'is_system' => true,
                    'role_categories' => ['approver'],
                ]);
            }
        }

        // ── Backfill college departments ────────────────────────────────
        // College departments are the ONLY departments available for the
        // requestor role. They also double as approver departments because
        // assigning an approver to a college department automatically
        // makes them the Office Head (department head) for that college.
        //
        // System departments (ITO, IMC, VPAA) are NOT available for requestors.
        Department::where('is_system', false)
            ->update(['role_categories' => json_encode(['requestor', 'approver'])]);
    }
}
