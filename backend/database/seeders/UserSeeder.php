<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            [
                'employee_id' => 'JMCFI-ADMIN-001',
                'first_name' => 'System',
                'middle_name' => '',
                'last_name' => 'Administrator',
                'email' => 'admin@jmc.edu.ph',
                'password' => 'password123',
                'phone' => '+639000000001',
                'department' => 'Information Technology Office',
                'position' => 'System Administrator',
                'status' => 'active',
                'roles' => ['it_admin', 'it_publisher'],
            ],
        ];

        foreach ($users as $userData) {
            $roles = $userData['roles'];
            unset($userData['roles']);

            $user = User::updateOrCreate(
                ['email' => $userData['email']],
                $userData
            );

            // syncRoles replaces ALL existing roles — ensures the admin
            // doesn't accidentally keep a stale 'requestor' role.
            $user->syncRoles($roles);
        }
    }
}