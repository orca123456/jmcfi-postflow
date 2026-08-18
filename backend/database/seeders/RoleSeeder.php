<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            // Generic / legacy roles
            [
                'name' => 'requestor',
                'display_name' => 'Requestor',
                'description' => 'Submits official content requests for announcements, news, events, advisories, and blogs.',
                'permissions' => ['create_post', 'edit_own_post', 'view_own_posts', 'submit_for_approval', 'revise_post'],
            ],
            [
                'name' => 'approver',
                'display_name' => 'Approver',
                'description' => 'Approves or returns department post requests.',
                'permissions' => ['view_pending_posts', 'approve_post', 'reject_post', 'return_for_revision', 'view_department_analytics'],
            ],
            [
                'name' => 'admin',
                'display_name' => 'Administrator',
                'description' => 'System administrator who manages users and publishes approved content.',
                'permissions' => ['view_ready_to_publish', 'schedule_post', 'publish_post', 'manage_publishing_queue', 'view_publishing_history'],
            ],
            // Granular roles used by middleware, workflow, and auth
            [
                'name' => 'it_admin',
                'display_name' => 'IT Administrator',
                'description' => 'Full system administrator with access to all settings, users, and publishing.',
                'permissions' => ['manage_users', 'manage_settings', 'view_ready_to_publish', 'schedule_post', 'publish_post', 'manage_publishing_queue', 'view_publishing_history'],
            ],
            [
                'name' => 'it_publisher',
                'display_name' => 'IT Publisher / System Operator',
                'description' => 'Publishes approved content to external platforms.',
                'permissions' => ['view_ready_to_publish', 'schedule_post', 'publish_post', 'manage_publishing_queue', 'view_publishing_history'],
            ],
            [
                'name' => 'office_head',
                'display_name' => 'Office Head',
                'description' => 'Approves post requests from their own department (Stage 1).',
                'permissions' => ['view_pending_posts', 'approve_post', 'reject_post', 'return_for_revision'],
            ],
            [
                'name' => 'vice_president',
                'display_name' => 'Vice President',
                'description' => 'Approves post requests at the VP level (Stage 2).',
                'permissions' => ['view_pending_posts', 'approve_post', 'reject_post', 'return_for_revision', 'view_department_analytics'],
            ],
            [
                'name' => 'imc_qa_checker',
                'display_name' => 'IMC / QA Checker',
                'description' => 'Final quality and branding gate before publishing (Stage 3).',
                'permissions' => ['view_pending_posts', 'approve_post', 'reject_post', 'return_for_revision'],
            ],
            [
                'name' => 'content_requestor',
                'display_name' => 'Content Requestor',
                'description' => 'Department head or programming head who creates content requests.',
                'permissions' => ['create_post', 'edit_own_post', 'view_own_posts', 'submit_for_approval', 'revise_post'],
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