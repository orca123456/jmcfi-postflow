<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class PostRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'slug',
        'caption_narrative',
        'category_id',
        'department_id',
        'requestor_id',
        'status',
        'target_platforms',
        'preferred_schedule_at',
        'published_at',
        'rejection_reason',
        'revision_notes',
        'revision_count',
        'ai_compliance_result',
        'ai_suggested_caption',
        'imc_branding_checklist',
    ];

    protected function casts(): array
    {
        return [
            'target_platforms' => 'array',
            'preferred_schedule_at' => 'datetime',
            'published_at' => 'datetime',
            'revision_notes' => 'array',
            'ai_compliance_result' => 'array',
            'ai_suggested_caption' => 'array',
            'imc_branding_checklist' => 'array',
        ];
    }

    public static function statuses(): array
    {
        return [
            'draft' => 'Draft',
            'pending_office_head' => 'Pending Office Head',
            'pending_vice_president' => 'Pending Vice President',
            'pending_president' => 'Pending President',
            'pending_imc_qa' => 'Pending IMC/QA',
            'approved' => 'Approved',
            'rejected' => 'Rejected',
            'returned_for_revision' => 'Returned for Revision',
            'scheduled' => 'Scheduled',
            'published' => 'Published',
            'archived' => 'Archived',
        ];
    }

    public static function approvalStages(): array
    {
        return [
            'office_head' => 'Office Head',
            'vice_president' => 'Vice President',
            'president' => 'President',
            'imc_qa' => 'IMC/QA Checker',
            'it_publisher' => 'IT Publisher',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(PostCategory::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(User::class, 'department_id');
    }

    public function requestor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requestor_id');
    }

    public function media(): HasMany
    {
        return $this->hasMany(PostMedia::class)->orderBy('sort_order');
    }

    public function featuredMedia(): HasOne
    {
        return $this->hasOne(PostMedia::class)->where('is_featured', true);
    }

    public function approvalWorkflows(): HasMany
    {
        return $this->hasMany(ApprovalWorkflow::class)->orderBy('stage');
    }

    public function currentApprovalStage(): ?ApprovalWorkflow
    {
        return $this->approvalWorkflows()
            ->where('action', 'pending')
            ->orderBy('stage')
            ->first();
    }

    public function aiComplianceCheck(): HasOne
    {
        return $this->hasOne(AIComplianceCheck::class);
    }

    public function policyViolations(): HasMany
    {
        return $this->hasMany(PolicyViolation::class);
    }

    public function publishingRecords(): HasMany
    {
        return $this->hasMany(PublishingRecord::class);
    }

    public function getStatusLabelAttribute(): string
    {
        return self::statuses()[$this->status] ?? $this->status;
    }

    public function getCurrentStageLabelAttribute(): ?string
    {
        $stage = $this->currentApprovalStage();
        return $stage ? self::approvalStages()[$stage->stage] ?? $stage->stage : null;
    }

    public function canBeEditedBy(User $user): bool
    {
        if ($this->status !== 'draft' && $this->status !== 'returned_for_revision') {
            return false;
        }
        return $this->requestor_id === $user->id || $user->hasRole('admin');
    }

    public function canBeApprovedBy(User $user): bool
    {
        $currentStage = $this->currentApprovalStage();
        if (!$currentStage) {
            return false;
        }

        $requiredRole = match ($currentStage->stage) {
            'office_head' => 'office_head',
            'vice_president' => 'vice_president',
            'president' => 'president',
            'imc_qa' => 'imc_qa_checker',
            'it_publisher' => 'it_publisher',
            default => null,
        };

        return $requiredRole && $user->hasRole($requiredRole);
    }

    public function getNextStage(): ?string
    {
        $stages = array_keys(self::approvalStages());
        $currentStage = $this->currentApprovalStage()?->stage;
        
        if (!$currentStage) {
            return $stages[0] ?? null;
        }

        $currentIndex = array_search($currentStage, $stages);
        if ($currentIndex !== false && $currentIndex < count($stages) - 1) {
            return $stages[$currentIndex + 1];
        }

        return null;
    }
}