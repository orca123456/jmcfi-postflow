<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            [
                'name' => 'requestor',
                'display_name' => 'Department Head / Programming Head',
                'description' => 'Submits official content requests for announcements, news, events, advisories, and blogs.',
                'permissions' => ['create_post', 'edit_own_post', 'view_own_posts', 'submit_for_approval', 'revise_post'],
            ],
            [
                'name' => 'office_head',
                'display_name' => 'Office Head',
                'description' => 'First-level approver. Reviews and approves or returns department post requests.',
                'permissions' => ['view_pending_posts', 'approve_post', 'reject_post', 'return_for_revision', 'view_department_analytics'],
            ],
            [
                'name' => 'vice_president',
                'display_name' => 'Vice President',
                'description' => 'Second-level approver. Reviews posts approved by Office Head.',
                'permissions' => ['view_pending_posts', 'approve_post', 'reject_post', 'return_for_revision', 'escalate_post'],
            ],
            [
                'name' => 'imc_qa_checker',
                'display_name' => 'IMC / QA Checker',
                'description' => 'Quality assurance and branding compliance reviewer before publishing.',
                'permissions' => ['view_approved_posts', 'approve_for_publishing', 'reject_for_branding', 'view_branding_checklist', 'run_ai_compliance_check'],
            ],
            [
                'name' => 'it_publisher',
                'display_name' => 'IT Admin / Publisher',
                'description' => 'System administrator who manages users, tokens, and schedules/publishes approved content.',
                'permissions' => ['view_ready_to_publish', 'schedule_post', 'publish_post', 'manage_publishing_queue', 'view_publishing_history'],
            ],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(
                ['name' => $role['name']],
                $role
            );
        }
    }
}