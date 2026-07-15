<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\PostCategory;

class PostCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            [
                'name' => 'Announcement',
                'slug' => 'announcement',
                'description' => 'Official institutional announcements and notices',
                'icon' => 'megaphone',
                'color' => '#3B82F6',
                'is_active' => true,
            ],
            [
                'name' => 'News',
                'slug' => 'news',
                'description' => 'News articles and press releases',
                'icon' => 'newspaper',
                'color' => '#10B981',
                'is_active' => true,
            ],
            [
                'name' => 'Event',
                'slug' => 'event',
                'description' => 'Upcoming events, activities, and programs',
                'icon' => 'calendar',
                'color' => '#F59E0B',
                'is_active' => true,
            ],
            [
                'name' => 'Advisory',
                'slug' => 'advisory',
                'description' => 'Official advisories and important notices',
                'icon' => 'alert-triangle',
                'color' => '#EF4444',
                'is_active' => true,
            ],
            [
                'name' => 'Blog',
                'slug' => 'blog',
                'description' => 'Blog posts and feature articles',
                'icon' => 'file-text',
                'color' => '#8B5CF6',
                'is_active' => true,
            ],
        ];

        foreach ($categories as $category) {
            PostCategory::updateOrCreate(
                ['slug' => $category['slug']],
                $category
            );
        }
    }
}