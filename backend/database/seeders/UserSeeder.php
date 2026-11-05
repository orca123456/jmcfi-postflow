<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $adminPassword = env('SEED_ADMIN_PASSWORD') ?: 'password123';
        $defaultPassword = Hash::make('password123');

        $users = [
            [
                'employee_id' => 'JMCFI-ADMIN-001',
                'first_name' => 'System',
                'middle_name' => '',
                'last_name' => 'Administrator',
                'email' => 'admin@jmc.edu.ph',
                'password' => $adminPassword,
                'phone' => '+639000000001',
                'department' => 'Information Technology Office',
                'position' => 'System Administrator',
                'status' => 'active',
                'roles' => ['it_admin', 'it_publisher'],
            ],
            [
                'employee_id' => 'JMCFI-HEAD-001',
                'first_name' => 'BSIT',
                'middle_name' => '',
                'last_name' => 'Head',
                'email' => 'head@jmc.edu.ph',
                'password' => $defaultPassword,
                'phone' => '+639000000002',
                'department' => 'BSIT Department',
                'position' => 'Department Head',
                'status' => 'active',
                'roles' => ['office_head'],
            ],
            [
                'employee_id' => 'JMCFI-VP-001',
                'first_name' => 'Vice',
                'middle_name' => '',
                'last_name' => 'President',
                'email' => 'vp@jmc.edu.ph',
                'password' => $defaultPassword,
                'phone' => '+639000000003',
                'department' => 'Vice President of Academic Affairs',
                'position' => 'Vice President',
                'status' => 'active',
                'roles' => ['vice_president'],
            ],
            [
                'employee_id' => 'JMCFI-IMC-001',
                'first_name' => 'Quality',
                'middle_name' => '',
                'last_name' => 'Lead',
                'email' => 'imc@jmc.edu.ph',
                'password' => $defaultPassword,
                'phone' => '+639000000004',
                'department' => 'Integrated Marketing Communications',
                'position' => 'Quality Reviewer',
                'status' => 'active',
                'roles' => ['imc_qa_checker'],
            ],
            [
                'employee_id' => 'JMCFI-REQ-001',
                'first_name' => 'Juan',
                'middle_name' => '',
                'last_name' => 'Dela Cruz',
                'email' => 'requestor@jmc.edu.ph',
                'password' => $defaultPassword,
                'phone' => '+639000000005',
                'department' => 'BSIT Department',
                'position' => 'Requestor',
                'status' => 'active',
                'roles' => ['requestor'],
            ],
        ];

        foreach ($users as $userData) {
            $roles = $userData['roles'];
            unset($userData['roles']);

            $user = User::updateOrCreate(
                ['email' => $userData['email']],
                $userData
            );

            $user->syncRoles($roles);
        }
    }
}
