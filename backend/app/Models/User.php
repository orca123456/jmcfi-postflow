<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles;

    protected $fillable = [
        'employee_id',
        'first_name',
        'middle_name',
        'last_name',
        'email',
        'password',
        'phone',
        'department',
        'program_head_id',
        'position',
        'status',
        'photo_path',
        'email_verified_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $appends = ['full_name', 'photo_url', 'department_logo_url', 'assigned_program'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function getFullNameAttribute(): string
    {
        $parts = [$this->first_name];
        if ($this->middle_name) {
            $parts[] = $this->middle_name;
        }
        $parts[] = $this->last_name;
        return implode(' ', $parts);
    }

    public function getPhotoUrlAttribute(): ?string
    {
        if (!$this->photo_path) {
            return null;
        }

        $disk = config('filesystems.default');
        if ($disk === 's3' || $disk === 'b2') {
            return \Illuminate\Support\Facades\Storage::disk($disk)->url($this->photo_path);
        }

        $version = $this->updated_at?->getTimestamp();
        $path = '/api/profile-photo/' . $this->getKey() . ($version ? '?v=' . $version : '');

        $railwayDomain = env('RAILWAY_PUBLIC_DOMAIN');
        if ($railwayDomain) {
            return 'https://' . rtrim($railwayDomain, '/') . $path;
        }

        $appUrl = config('app.url');
        if ($appUrl && !str_contains($appUrl, 'localhost')) {
            return rtrim($appUrl, '/') . $path;
        }

        if (request()->hasHeader('Host')) {
            return request()->schemeAndHttpHost() . $path;
        }

        return url($path);
    }

    public function getDepartmentLogoUrlAttribute(): ?string
    {
        if ($this->program_head_id) {
            $ph = $this->relationLoaded('programHead') ? $this->programHead : $this->programHead()->first();
            if ($ph && $ph->department && $ph->department->logo_url) {
                return $ph->department->logo_url;
            }
        }
        if (!$this->department) {
            return null;
        }

        // 1. Exact match by name or display_name
        $dept = \App\Models\Department::where('name', $this->department)
                                      ->orWhere('display_name', $this->department)
                                      ->first();
        if ($dept && $dept->logo_url) {
            return $dept->logo_url;
        }

        // 2. Case-insensitive / normalized match across departments with a logo
        $deptClean = strtolower(trim($this->department));
        $allDepts = \App\Models\Department::whereNotNull('logo_path')
            ->where('logo_path', '!=', '')
            ->get();

        foreach ($allDepts as $d) {
            $dName = strtolower(trim($d->name));
            $dDisplay = strtolower(trim($d->display_name));
            if ($dName === $deptClean || $dDisplay === $deptClean) {
                return $d->logo_url;
            }
        }

        // 3. Known Institutional Aliases & Keyword matching
        $isIT = str_contains($deptClean, 'bsit') || str_contains($deptClean, 'information technology') || str_contains($deptClean, 'computer') || str_contains($deptClean, 'cite');
        $isAgri = str_contains($deptClean, 'agri');
        $isEng = str_contains($deptClean, 'engineer');
        $isBsa = str_contains($deptClean, 'bsa') || str_contains($deptClean, 'accountan');
        $isPsyc = str_contains($deptClean, 'psyc');

        foreach ($allDepts as $d) {
            $target = strtolower($d->name . ' ' . $d->display_name);
            if ($isIT && (str_contains($target, 'information technology') || str_contains($target, 'computer') || str_contains($target, 'bsit') || str_contains($target, 'cite'))) {
                return $d->logo_url;
            }
            if ($isAgri && str_contains($target, 'agri')) {
                return $d->logo_url;
            }
            if ($isEng && str_contains($target, 'engineer')) {
                return $d->logo_url;
            }
            if ($isBsa && (str_contains($target, 'bsa') || str_contains($target, 'accountan'))) {
                return $d->logo_url;
            }
            if ($isPsyc && str_contains($target, 'psyc')) {
                return $d->logo_url;
            }
        }

        // 4. Substring / partial match fallback
        foreach ($allDepts as $d) {
            $dDisplay = strtolower(trim($d->display_name));
            $dName = strtolower(trim($d->name));
            if (str_contains($deptClean, $dDisplay) || str_contains($dDisplay, $deptClean) ||
                str_contains($deptClean, $dName) || str_contains($dName, $deptClean)) {
                return $d->logo_url;
            }
        }

        return null;
    }

    public function programHead(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(ProgramHead::class, 'program_head_id');
    }

    public function getEffectiveProgramHeadId(): ?int
    {
        if ($this->program_head_id) {
            return (int) $this->program_head_id;
        }

        if (!\Illuminate\Support\Facades\Schema::hasTable('program_heads')) {
            return null;
        }

        $phByUser = ProgramHead::where('user_id', $this->id)->first();
        if ($phByUser) {
            return (int) $phByUser->id;
        }

        return null;
    }

    public function getAssignedProgramAttribute(): ?string
    {
        if (!\Illuminate\Support\Facades\Schema::hasTable('program_heads')) {
            return null;
        }

        $ph = $this->relationLoaded('programHead') ? $this->programHead : $this->programHead()->first();
        if ($ph && !empty($ph->program_name)) {
            return $ph->program_name;
        }

        $phByUser = ProgramHead::where('user_id', $this->id)->first();
        if ($phByUser && !empty($phByUser->program_name)) {
            return $phByUser->program_name;
        }

        if ($this->department) {
            $deptRecord = Department::where('display_name', $this->department)
                ->orWhere('name', $this->department)
                ->first();
            if ($deptRecord) {
                $deptPh = ProgramHead::where('department_id', $deptRecord->id)
                    ->where(function ($q) {
                        $q->where('user_id', $this->id)
                          ->orWhere('email', $this->email)
                          ->orWhere('name', $this->first_name)
                          ->orWhere('name', $this->full_name);
                    })->first();
                if ($deptPh && !empty($deptPh->program_name)) {
                    if (!$deptPh->user_id) {
                        $deptPh->update(['user_id' => $this->id]);
                    }
                    return $deptPh->program_name;
                }
            }
        }

        if (!empty($this->position) && str_contains($this->position, 'Program Head')) {
            $extracted = trim(str_replace('Program Head', '', $this->position));
            if ($extracted !== '') {
                return $extracted;
            }
        }

        return null;
    }

    public function getDisplayNameAttribute(): string
    {
        return $this->first_name . ' ' . $this->last_name;
    }

    public function postRequests()
    {
        return $this->hasMany(PostRequest::class, 'requestor_id');
    }

    public function approvalWorkflows()
    {
        return $this->hasMany(ApprovalWorkflow::class, 'approver_id');
    }

    public function aiComplianceChecks()
    {
        return $this->hasMany(AIComplianceCheck::class, 'checked_by_user_id');
    }

    public function policyViolations()
    {
        return $this->hasMany(PolicyViolation::class, 'user_id');
    }

    public function publishingRecords()
    {
        return $this->hasMany(PublishingRecord::class, 'published_by');
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Map the user's raw DB role to the app's role category used for data scoping.
     * The DB stores granular roles (it_publisher, office_head, vice_president,
     * imc_qa_checker, content_requestor, requestor), while the app logic is written
     * against three categories — mirroring the frontend normalization:
     *   - admin     -> it_publisher, it_admin
     *   - approver  -> office_head, vice_president, imc_qa_checker
     *   - requestor -> requestor, content_requestor
     */
    public function roleCategory(): string
    {
        $role = $this->workflowRole();

        return match ($role) {
            'it_publisher', 'it_admin' => 'admin',
            'office_head', 'vice_president', 'imc_qa_checker' => 'approver',
            'requestor', 'content_requestor' => 'requestor',
            default => $role ?? 'requestor',
        };
    }

    public function workflowRole(): ?string
    {
        $role = $this->getRoleNames()->first();
        $department = strtolower($this->department ?? '');

        if ($role === 'it_admin' || $role === 'admin') {
            return $role;
        }

        if (str_contains($department, 'vice president') || str_contains($department, 'vpaa')) {
            return 'vice_president';
        }

        if (
            str_contains($department, 'integrated marketing')
            || str_contains($department, 'institutional marketing')
            || str_contains($department, 'marketing communication')
            || str_contains($department, 'imc')
        ) {
            return 'imc_qa_checker';
        }

        return $role;
    }

    // NOTE: hasAnyRole() intentionally not overridden — Spatie's HasRoles trait
    // provides it. A previous custom override recursively called itself and
    // exhausted PHP's memory (fixed 2026-08-09).

    public static function roleLabels(): array
    {
        return [
            'requestor' => 'Department Head / Programming Head',
            'office_head' => 'Department Head',
            'vice_president' => 'Vice President',
            'president' => 'President',
            'imc_qa_checker' => 'Integrated Marketing Communications',
            'it_publisher' => 'IT Publisher / System Operator',
            'admin' => 'Administrator',
        ];
    }
}
