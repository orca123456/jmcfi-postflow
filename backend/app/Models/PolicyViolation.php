<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PolicyViolation extends Model
{
    use HasFactory;

    protected $fillable = [
        'post_request_id',
        'user_id',
        'flagged_by',
        'violation_type',
        'description',
        'severity',
        'ai_analysis',
        'is_resolved',
        'resolved_at',
        'resolved_by',
    ];

    protected function casts(): array
    {
        return [
            'ai_analysis' => 'array',
            'is_resolved' => 'boolean',
            'resolved_at' => 'datetime',
        ];
    }

    public function postRequest(): BelongsTo
    {
        return $this->belongsTo(PostRequest::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function flaggedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'flagged_by');
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public static function types(): array
    {
        return [
            'accuracy' => 'Accuracy',
            'completeness' => 'Completeness',
            'branding' => 'Branding',
            'privacy' => 'Privacy',
            'compliance' => 'Posting Compliance',
        ];
    }

    public static function severities(): array
    {
        return [
            'low' => 'Low',
            'medium' => 'Medium',
            'high' => 'High',
            'critical' => 'Critical',
        ];
    }

    public function getTypeLabelAttribute(): string
    {
        return self::types()[$this->violation_type] ?? $this->violation_type;
    }

    public function getSeverityLabelAttribute(): string
    {
        return self::severities()[$this->severity] ?? $this->severity;
    }

    public function getSeverityColorAttribute(): string
    {
        return match ($this->severity) {
            'low' => 'green',
            'medium' => 'yellow',
            'high' => 'orange',
            'critical' => 'red',
            default => 'gray',
        };
    }
}