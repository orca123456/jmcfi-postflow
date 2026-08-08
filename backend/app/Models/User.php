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
        'position',
        'status',
        'photo_path',
    ];

    protected $appends = ['full_name', 'photo_url', 'department_logo_url'];

    protected $hidden = [
        'password',
        'remember_token',
    ];

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
        $normalizedPath = str_replace('\\', '/', $this->photo_path);
        return asset('storage/' . $normalizedPath);
    }

    public function getDepartmentLogoUrlAttribute(): ?string
    {
        if (!$this->department) {
            return null;
        }
        $dept = \App\Models\Department::where('name', $this->department)
                                      ->orWhere('display_name', $this->department)
                                      ->first();
        return $dept ? $dept->logo_url : null;
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

    public function hasAnyRole(array $roles): bool
    {
        return $this->hasAnyRole($roles);
    }

    public static function roleLabels(): array
    {
        return [
            'requestor' => 'Department Head / Programming Head',
            'office_head' => 'Office Head',
            'vice_president' => 'Vice President',
            'president' => 'President',
            'imc_qa_checker' => 'IMC / QA Checker',
            'it_publisher' => 'IT Publisher / System Operator',
            'admin' => 'Administrator',
        ];
    }
}