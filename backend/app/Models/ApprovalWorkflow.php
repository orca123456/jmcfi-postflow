<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApprovalWorkflow extends Model
{
    use HasFactory;

    protected $fillable = [
        'post_request_id',
        'stage', // office_head, vice_president, president, imc_qa
        'approver_id',
        'action', // pending, approved, rejected, returned_for_revision
        'remarks',
        'acted_at',
        'stage_order',
    ];

    protected function casts(): array
    {
        return [
            'acted_at' => 'datetime',
            'stage_order' => 'integer',
        ];
    }

    public function postRequest(): BelongsTo
    {
        return $this->belongsTo(PostRequest::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_id');
    }

    public static function stages(): array
    {
        return [
            'office_head' => 'Office Head',
            'vice_president' => 'Vice President',
            'imc_qa' => 'IMC/QA Checker',
        ];
    }

    public static function actions(): array
    {
        return [
            'pending' => 'Pending',
            'approved' => 'Approved',
            'rejected' => 'Rejected',
            'returned_for_revision' => 'Returned for Revision',
        ];
    }

    public function getStageLabelAttribute(): string
    {
        return self::stages()[$this->stage] ?? $this->stage;
    }

    public function getActionLabelAttribute(): string
    {
        return self::actions()[$this->action] ?? $this->action;
    }
}