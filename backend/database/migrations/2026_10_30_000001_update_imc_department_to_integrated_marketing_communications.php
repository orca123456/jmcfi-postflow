<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Models\Department;
use App\Models\User;
use App\Models\ApprovalWorkflow;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Ensure 'imc_qa_checker' role exists in Spatie roles
        $imcRole = Role::firstOrCreate(['name' => 'imc_qa_checker', 'guard_name' => 'web'], ['display_name' => 'Integrated Marketing Communications']);

        // 2. Update Department to 'Integrated Marketing Communications'
        Department::where('name', 'ILIKE', '%Institutional Marketing%')
            ->orWhere('display_name', 'ILIKE', '%Institutional Marketing%')
            ->orWhere('name', 'ILIKE', '%IMC%')
            ->orWhere('display_name', 'ILIKE', '%IMC%')
            ->update([
                'name' => 'Integrated Marketing Communications',
                'display_name' => 'Integrated Marketing Communications',
                'is_system' => true,
            ]);

        // If no IMC department exists at all, create it
        if (!Department::where('display_name', 'Integrated Marketing Communications')->exists()) {
            Department::create([
                'name' => 'Integrated Marketing Communications',
                'display_name' => 'Integrated Marketing Communications',
                'is_system' => true,
                'role_categories' => ['approver'],
            ]);
        }

        // 3. Update existing users with legacy IMC department names
        User::where('department', 'ILIKE', '%Institutional Marketing%')
            ->orWhere('department', 'ILIKE', '%IMC%')
            ->update([
                'department' => 'Integrated Marketing Communications',
            ]);

        // 4. Ensure any approver in Integrated Marketing Communications has the imc_qa_checker role
        $imcUsers = User::where('department', 'ILIKE', '%Integrated Marketing%')
            ->orWhere('department', 'ILIKE', '%Marketing Communication%')
            ->get();

        foreach ($imcUsers as $user) {
            if (!$user->hasRole('admin') && !$user->hasRole('it_admin')) {
                // Remove office_head if erroneously assigned
                if ($user->hasRole('office_head')) {
                    $user->removeRole('office_head');
                }
                if (!$user->hasRole('imc_qa_checker')) {
                    $user->assignRole('imc_qa_checker');
                }
                $user->position = 'Integrated Marketing Communications';
                $user->save();
            }
        }

        // 5. Backfill approver_id for any existing approval_workflows for stage 'imc_qa'
        $imcUser = User::role('imc_qa_checker')->where('status', 'active')->first();
        if ($imcUser) {
            ApprovalWorkflow::where('stage', 'imc_qa')
                ->whereNull('approver_id')
                ->update(['approver_id' => $imcUser->id]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reversible if needed
    }
};

