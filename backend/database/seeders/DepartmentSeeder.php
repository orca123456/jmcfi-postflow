<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Department;

class DepartmentSeeder extends Seeder
{
    public function run(): void
    {
        $departments = [
            ['name' => 'Information Technology Office', 'display_name' => 'Information Technology Office', 'description' => 'IT Department'],
            ['name' => 'Vice President of Academic Affairs', 'display_name' => 'Vice President of Academic Affairs', 'description' => 'VPAA Office'],
            ['name' => 'Institutional Marketing Communication', 'display_name' => 'Institutional Marketing Communication', 'description' => 'IMC Department'],
            ['name' => 'College of Agriculture', 'display_name' => 'College of Agriculture', 'description' => 'College of Agriculture'],
        ];

        foreach ($departments as $dept) {
            Department::updateOrCreate(
                ['name' => $dept['name']],
                $dept
            );
        }
    }
}
