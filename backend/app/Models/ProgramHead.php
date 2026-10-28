<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProgramHead extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'program_heads';

    protected $fillable = [
        'department_id',
        'user_id',
        'name',
        'program_name',
        'email',
        'phone',
        'order_index',
        'is_active',
    ];

    protected $casts = [
        'order_index' => 'integer',
        'is_active' => 'boolean',
    ];

    protected $appends = [
        'order_label',
    ];

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getOrderLabelAttribute(): string
    {
        $n = max(1, (int) $this->order_index);
        $ends = ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'];
        if ((($n % 100) >= 11) && (($n % 100) <= 13)) {
            return "{$n}th Program Head";
        }
        return "{$n}" . ($ends[$n % 10] ?? 'th') . " Program Head";
    }
}
