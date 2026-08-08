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
    public const STATUS_ARCHIVED = 'archived';

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
        return $this->approvalWorkflows()
            ->where('action', 'pending')
            // No need for a second orderBy since relation already handles it, but we can be explicit
            ->orderBy('stage_order')
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
        $baseLabel = self::statuses()[$this->status] ?? $this->status;
        
        if ($this->status === 'returned_for_revision' || $this->status === 'rejected') {
            $latestRejection = $this->approvalWorkflows()
                ->whereIn('action', ['rejected', 'returned_for_revision'])
                ->latest('acted_at')
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
        Log::info("canBeApprovedBy called for Post ID: {$this->id} by User ID: {$user->id}");
        if (!$currentStage) {
            Log::info("No current stage found!");
            return false;
        }

        Log::info("Current stage is: {$currentStage->stage}");

        // Admin can always approve
        if ($user->hasRole('admin')) {
            return true;
        }

        // Must have the 'approver' role
        if (!$user->hasRole('approver')) {
            Log::info("User does not have 'approver' role");
            return false;
        }

        // Match approval stage to the user's department
        $canApprove = match ($currentStage->stage) {
            'office_head' => !in_array($user->department, ['Vice President of Academic Affairs', 'Institutional Marketing Communication', 'Information Technology Office'])
                && $user->department === $this->requestor?->department,
            'vice_president' => $user->department === 'Vice President of Academic Affairs',
            'imc_qa' => $user->department === 'Institutional Marketing Communication',
            default => false,
        };

        Log::info("User department: {$user->department}, Can approve: " . ($canApprove ? 'Yes' : 'No'));

        return $canApprove;
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