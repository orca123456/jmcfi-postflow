<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostMedia extends Model
{
    use HasFactory;

    protected $fillable = [
        'post_request_id',
        'type',
        'original_name',
        'file_path',
        'mime_type',
        'file_size',
        'sort_order',
        'is_featured',
    ];

    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
            'is_featured' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function postRequest(): BelongsTo
    {
        return $this->belongsTo(PostRequest::class);
    }

    public function getTypeLabelAttribute(): string
    {
        return match ($this->type) {
            'image' => 'Image',
            'video' => 'Video',
            'document' => 'Document',
            default => $this->type,
        };
    }

    public function getFormattedSizeAttribute(): string
    {
        $bytes = $this->file_size;
        if ($bytes >= 1048576) {
            return number_format($bytes / 1048576, 2) . ' MB';
        } elseif ($bytes >= 1024) {
            return number_format($bytes / 1024, 2) . ' KB';
        }
        return $bytes . ' bytes';
    }

    public function getUrlAttribute(): string
    {
        if (env('RENDER_EXTERNAL_URL')) {
            return rtrim(env('RENDER_EXTERNAL_URL'), '/') . '/storage/' . $this->file_path;
        }
        
        $url = \Illuminate\Support\Facades\Storage::disk('public')->url($this->file_path);
        
        // Fallback for cases where APP_URL is still localhost but accessed externally
        if (str_contains($url, 'localhost') && request()->getHost() !== 'localhost') {
            return request()->getSchemeAndHttpHost() . '/storage/' . $this->file_path;
        }

        return $url;
    }
}