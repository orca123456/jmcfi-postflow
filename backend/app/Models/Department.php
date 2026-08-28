<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class Department extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'display_name',
        'description',
        'logo_path',
        'is_active',
        'is_system',
        'role_categories',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_system' => 'boolean',
            'role_categories' => 'array',
        ];
    }

    protected $appends = ['logo_url'];

    public function getLogoUrlAttribute(): ?string
    {
        if (!$this->logo_path) {
            return null;
        }

        $disk = config('filesystems.default') === 'local' ? 'public' : config('filesystems.default');

        return Storage::disk($disk)->url($this->logo_path);
    }
}
