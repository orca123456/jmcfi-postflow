<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Department;

class DepartmentSeeder extends Seeder
{
    public function run(): void
    {
        $departments = [
            ['name' => 'ict', 'display_name' => 'ICT', 'description' => 'Information and Communications Technology'],
            ['name' => 'marketing', 'display_name' => 'Marketing', 'description' => 'Marketing Department'],
            ['name' => 'academic_affairs', 'display_name' => 'Academic Affairs', 'description' => 'Office of Academic Affairs'],
            ['name' => 'administration', 'display_name' => 'Administration', 'description' => 'Administration Office'],
            ['name' => 'office_of_the_president', 'display_name' => 'Office of the President', 'description' => 'Office of the President'],
            ['name' => 'imc', 'display_name' => 'Institutional Marketing & Communications', 'description' => 'IMC Department'],
        ];

        foreach ($departments as $dept) {
            Department::updateOrCreate(
                ['name' => $dept['name']],
                $dept
            );
        }
    }
}
