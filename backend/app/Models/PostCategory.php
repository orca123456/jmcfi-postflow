<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PostCategory extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'icon',
        'color',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public static function defaultCategories(): array
    {
        return [
            ['name' => 'Announcement', 'slug' => 'announcement', 'icon' => 'megaphone', 'color' => '#3B82F6'],
            ['name' => 'News', 'slug' => 'news', 'icon' => 'newspaper', 'color' => '#10B981'],
            ['name' => 'Event', 'slug' => 'event', 'icon' => 'calendar', 'color' => '#F59E0B'],
            ['name' => 'Advisory', 'slug' => 'advisory', 'icon' => 'alert-triangle', 'color' => '#EF4444'],
            ['name' => 'Blog', 'slug' => 'blog', 'icon' => 'file-text', 'color' => '#8B5CF6'],
        ];
    }
}