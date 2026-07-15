<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PublishingRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'post_request_id',
        'published_by',
        'platform',
        'external_post_id',
        'external_url',
        'status',
        'scheduled_at',
        'published_at',
        'error_message',
        'platform_response',
    ];

    protected function casts(): array
    {
        return [
            'platform_response' => 'array',
            'scheduled_at' => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    public function postRequest(): BelongsTo
    {
        return $this->belongsTo(PostRequest::class);
    }

    public function publishedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }

    public static function statuses(): array
    {
        return [
            'scheduled' => 'Scheduled',
            'publishing' => 'Publishing',
            'published' => 'Published',
            'failed' => 'Failed',
            'deleted' => 'Deleted',
        ];
    }

    public static function platforms(): array
    {
        return [
            'wordpress' => 'WordPress',
            'facebook' => 'Facebook',
            'instagram' => 'Instagram',
        ];
    }

    public function getStatusLabelAttribute(): string
    {
        return self::statuses()[$this->status] ?? $this->status;
    }

    public function getPlatformLabelAttribute(): string
    {
        return self::platforms()[$this->platform] ?? $this->platform;
    }
}