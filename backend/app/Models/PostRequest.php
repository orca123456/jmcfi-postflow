<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Facades\Log;

class PostRequest extends Model
{
    use HasFactory;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_PENDING_OFFICE_HEAD = 'pending_office_head';
    public const STATUS_PENDING_VICE_PRESIDENT = 'pending_vice_president';
    public const STATUS_PENDING_PRESIDENT = 'pending_president';
    public const STATUS_PENDING_IMC_QA = 'pending_imc_qa';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_RETURNED_FOR_REVISION = 'returned_for_revision';
    public const STATUS_SCHEDULED = 'scheduled';
    public const STATUS_PUBLISHED = 'published';
    public const STATUS_PUBLISH_FAILED = 'publish_failed';
    public const STATUS_ARCHIVED = 'archived';

    protected $fillable = [
        'title',
        'slug',
        'caption_narrative',
        'category_id',
        'other_category_name',
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

    protected $appends = ['current_approval_stage', 'current_stage_label'];

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
        return $this->hasMany(ApprovalWorkflow::class)->orderBy('stage_order');
    }

    public function currentApprovalStage(): ?ApprovalWorkflow
    {
        // Use the eager-loaded collection to avoid N+1 queries
        return $this->approvalWorkflows
            ->where('action', 'pending')
            ->sortBy('stage_order')
            ->first();
    }

    public function getCurrentApprovalStageAttribute(): ?string
    {
        return $this->currentApprovalStage()?->stage;
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
        $baseLabel = self::statuses()[$this->status] ?? $this->status;
        
        if ($this->status === 'returned_for_revision' || $this->status === 'rejected') {
            // Use the eager-loaded collection to avoid N+1 queries
            $latestRejection = $this->approvalWorkflows
                ->whereIn('action', ['rejected', 'returned_for_revision'])
                ->sortByDesc('acted_at')
                ->first();
            
            if ($latestRejection) {
                $stageLabel = ApprovalWorkflow::stages()[$latestRejection->stage] ?? $latestRejection->stage;
                return "Rejected by {$stageLabel}";
            }
        }
        
        return $baseLabel;
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
        $stageName = $currentStage?->stage;

        if (!$stageName) {
            $stageName = match ($this->status) {
                self::STATUS_PENDING_OFFICE_HEAD => 'office_head',
                self::STATUS_PENDING_VICE_PRESIDENT => 'vice_president',
                self::STATUS_PENDING_PRESIDENT => 'president',
                self::STATUS_PENDING_IMC_QA => 'imc_qa',
                default => null,
            };
        }

        if (!$stageName) {
            return false;
        }

        $role = $user->getRoleNames()->first();

        // Admins (it_publisher / it_admin) can always approve
        if (in_array($role, ['it_publisher', 'it_admin', 'admin'], true)) {
            return true;
        }

        // Only approver roles may approve (office_head / vice_president / imc_qa_checker)
        if (!in_array($role, ['office_head', 'vice_president', 'imc_qa_checker'], true)) {
            return false;
        }

        if ($currentStage?->approver_id === $user->id) {
            return true;
        }

        // Match the approval stage to the user's RAW role
        return match ($stageName) {
            // Office Head approves stage 1 — must belong to the requestor's department (case-insensitive)
            'office_head'    => $role === 'office_head' && strcasecmp(trim($user->department ?? ''), trim($this->requestor?->department ?? '')) === 0,
            'vice_president' => $role === 'vice_president',
            'imc_qa'         => $role === 'imc_qa_checker',
            default          => false,
        };
    }

    public function getNextStage(): ?string
    {
        $stages = array_keys(self::approvalStages());
        $currentStageName = $this->currentApprovalStage()?->stage;
        
        if (!$currentStageName) {
            $currentStageName = match ($this->status) {
                self::STATUS_PENDING_OFFICE_HEAD => 'office_head',
                self::STATUS_PENDING_VICE_PRESIDENT => 'vice_president',
                self::STATUS_PENDING_PRESIDENT => 'president',
                self::STATUS_PENDING_IMC_QA => 'imc_qa',
                default => null,
            };
        }

        if (!$currentStageName) {
            return $stages[0] ?? null;
        }

        $currentIndex = array_search($currentStageName, $stages);
        if ($currentIndex !== false && $currentIndex < count($stages) - 1) {
            return $stages[$currentIndex + 1];
        }

        return null;
    }
}
