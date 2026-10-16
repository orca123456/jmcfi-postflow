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
                'name' => 'Vice President of Academic Affairs',
                'display_name' => 'Vice President of Academic Affairs',
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

        $legacyIt = Department::where('name', 'department_of_information_technology')
            ->orWhere('display_name', 'Department of Information Technology')
            ->first();
        if ($legacyIt) {
            if (Department::where('name', 'Information Technology Office')->where('id', '!=', $legacyIt->id)->exists()) {
                $legacyIt->forceDelete();
            } else {
                $legacyIt->update([
                    'name' => 'Information Technology Office',
                    'display_name' => 'Information Technology Office',
                    'is_system' => true,
                    'role_categories' => ['admin'],
                ]);
            }
        }

        // Clean up legacy name if it exists (was "Vice President for Academic Affairs")
        $legacy = Department::where('name', 'Vice President for Academic Affairs')->first();
        if ($legacy) {
            // If the correct one already exists, just remove the old one
            if (Department::where('name', 'Vice President of Academic Affairs')->exists()) {
                $legacy->forceDelete();
            } else {
                $legacy->update([
                    'name' => 'Vice President of Academic Affairs',
                    'display_name' => 'Vice President of Academic Affairs',
                    'is_system' => true,
                    'role_categories' => ['approver'],
                ]);
            }
        }

        // ── Seed college departments (available for requestor and approver) ──
        $collegeDepartments = [
            [
                'name' => 'BSA',
                'display_name' => 'BSA',
                'description' => 'Bachelor of Science in Accountancy',
                'is_system' => false,
                'is_active' => true,
                'role_categories' => ['requestor', 'approver'],
            ],
            [
                'name' => 'College of Information Technology',
                'display_name' => 'College of Information Technology',
                'description' => 'College of Information Technology',
                'is_system' => false,
                'is_active' => true,
                'role_categories' => ['requestor', 'approver'],
            ],
            [
                'name' => 'Psyc',
                'display_name' => 'Psyc',
                'description' => 'Department of Psychology',
                'is_system' => false,
                'is_active' => true,
                'role_categories' => ['requestor', 'approver'],
            ],
        ];

        foreach ($collegeDepartments as $dept) {
            Department::updateOrCreate(
                ['name' => $dept['name']],
                $dept
            );
        }

        // College departments are the ONLY departments available for the
        // requestor role. They also double as approver departments because
        // assigning an approver to a college department automatically
        // makes them the Office Head (department head) for that college.
        Department::where('is_system', false)
            ->update(['role_categories' => json_encode(['requestor', 'approver'])]);
    }
}
