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
        'file_path',
        'original_name',
        'mime_type',
        'file_size',
        'type',
        'is_featured',
        'sort_order',
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
}