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
                'password' => Hash::make('password123'),
                'phone' => '+639000000001',
                'department' => 'ICT',
                'position' => 'System Administrator',
                'status' => 'active',
                'roles' => ['admin'],
            ],
            [
                'employee_id' => 'JMCFI-REQ-001',
                'first_name' => 'Maria',
                'middle_name' => 'Santos',
                'last_name' => 'Dela Cruz',
                'email' => 'maria.delacruz@jmc.edu.ph',
                'password' => Hash::make('password123'),
                'phone' => '+639000000002',
                'department' => 'Marketing',
                'position' => 'Department Head',
                'status' => 'active',
                'roles' => ['requestor'],
            ],
            [
                'employee_id' => 'JMCFI-OH-001',
                'first_name' => 'Juan',
                'middle_name' => 'Pedro',
                'last_name' => 'Garcia',
                'email' => 'juan.garcia@jmc.edu.ph',
                'password' => Hash::make('password123'),
                'phone' => '+639000000003',
                'department' => 'Academic Affairs',
                'position' => 'Office Head',
                'status' => 'active',
                'roles' => ['office_head'],
            ],
            [
                'employee_id' => 'JMCFI-VP-001',
                'first_name' => 'Roberto',
                'middle_name' => 'Luis',
                'last_name' => 'Fernandez',
                'email' => 'roberto.fernandez@jmc.edu.ph',
                'password' => Hash::make('password123'),
                'phone' => '+639000000004',
                'department' => 'Administration',
                'position' => 'Vice President',
                'status' => 'active',
                'roles' => ['vice_president'],
            ],
            [
                'employee_id' => 'JMCFI-PRES-001',
                'first_name' => 'Atty. Jose',
                'middle_name' => 'Maria',
                'last_name' => 'Reyes',
                'email' => 'jose.reyes@jmc.edu.ph',
                'password' => Hash::make('password123'),
                'phone' => '+639000000005',
                'department' => 'Office of the President',
                'position' => 'President',
                'status' => 'active',
                'roles' => ['president'],
            ],
            [
                'employee_id' => 'JMCFI-IMC-001',
                'first_name' => 'Ana',
                'middle_name' => 'Liza',
                'last_name' => 'Torres',
                'email' => 'ana.torres@jmc.edu.ph',
                'password' => Hash::make('password123'),
                'phone' => '+639000000006',
                'department' => 'Institutional Marketing & Communications',
                'position' => 'IMC/QA Checker',
                'status' => 'active',
                'roles' => ['imc_qa_checker'],
            ],
            [
                'employee_id' => 'JMCFI-ITP-001',
                'first_name' => 'Mark',
                'middle_name' => 'Anthony',
                'last_name' => 'Villanueva',
                'email' => 'mark.villanueva@jmc.edu.ph',
                'password' => Hash::make('password123'),
                'phone' => '+639000000007',
                'department' => 'ICT',
                'position' => 'IT Publisher',
                'status' => 'active',
                'roles' => ['it_publisher'],
            ],
        ];

        foreach ($users as $userData) {
            $roles = $userData['roles'];
            unset($userData['roles']);

            $user = User::updateOrCreate(
                ['email' => $userData['email']],
                $userData
            );

            $user->assignRole($roles);
        }
    }
}