<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

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

    protected $appends = [
        'url',
        'type_label',
        'formatted_size'
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

    public function file(): HasOne
    {
        return $this->hasOne(PostMediaFile::class);
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
        $disk = config('filesystems.default');
        $normalizedPath = str_replace('\\', '/', $this->file_path);

        if ($disk === 's3' || $disk === 'b2') {
            return \Illuminate\Support\Facades\Storage::disk($disk)->url($normalizedPath);
        }

        // 1. If RENDER_EXTERNAL_URL is set (Render production), use it as base
        $renderUrl = config('app.render_external_url');
        if ($renderUrl) {
            return rtrim($renderUrl, '/') . '/storage/' . $normalizedPath;
        }

        return asset('storage/' . $normalizedPath);
    }
}
