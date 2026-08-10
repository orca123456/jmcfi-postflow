<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Department extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'display_name',
        'description',
        'logo_path',
        'is_active',
        'role_categories',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'role_categories' => 'array',
        ];
    }

    protected $appends = ['logo_url'];

    public function getLogoUrlAttribute(): ?string
    {
        if (!$this->logo_path) {
            return null;
        }
        return asset('storage/' . $this->logo_path);
    }
}
