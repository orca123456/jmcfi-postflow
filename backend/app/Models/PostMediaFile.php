<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostMediaFile extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'post_media_id',
        'content',
    ];

    public function media(): BelongsTo
    {
        return $this->belongsTo(PostMedia::class, 'post_media_id');
    }
}
