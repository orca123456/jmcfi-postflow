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
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(
                ['name' => $role['name']],
                $role
            );
        }
    }
}