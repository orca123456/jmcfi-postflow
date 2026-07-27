<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AIComplianceCheck extends Model
{
    use HasFactory;

    protected $table = 'ai_compliance_checks';

    protected $fillable = [
        'post_request_id',
        'checked_by_user_id',
        'check_results',
        'violations_found',
        'suggested_rejection_reason',
        'suggested_revision_guidance',
        'suggested_improved_caption',
        'overall_status',
        'confidence_score',
        'model_used',
        'prompt_used',
    ];

    protected function casts(): array
    {
        return [
            'check_results' => 'array',
            'violations_found' => 'array',
            'suggested_rejection_reason' => 'string',
            'suggested_revision_guidance' => 'string',
            'suggested_improved_caption' => 'string',
            'overall_status' => 'string',
            'confidence_score' => 'decimal:2',
        ];
    }

    public function postRequest(): BelongsTo
    {
        return $this->belongsTo(PostRequest::class);
    }

    public function checkedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_by_user_id');
    }

    public static function statuses(): array
    {
        return [
            'pass' => 'Pass',
            'fail' => 'Fail',
            'review_required' => 'Review Required',
        ];
    }

    public function getOverallStatusLabelAttribute(): string
    {
        return self::statuses()[$this->overall_status] ?? $this->overall_status;
    }

    public function getViolationsCountAttribute(): int
    {
        return count($this->violations_found ?? []);
    }
}