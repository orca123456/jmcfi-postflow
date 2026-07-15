<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TargetPlatform extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'icon',
        'color',
        'config_schema',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'config_schema' => 'array',
            'is_active' => 'boolean',
        ];
    }
}