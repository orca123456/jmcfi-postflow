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
        // 1. Ensure 'imc_qa_checker' role exists in roles table
        $roleData = [
            'name' => 'imc_qa_checker',
            'guard_name' => 'web',
            'display_name' => 'Integrated Marketing Communications',
            'description' => 'Final quality and branding gate before publishing (Stage 3).',
            'permissions' => json_encode(['view_pending_posts', 'approve_post', 'reject_post', 'return_for_revision']),
            'updated_at' => now(),
        ];

        $existingRole = DB::table('roles')->where('name', 'imc_qa_checker')->first();
        if ($existingRole) {
            DB::table('roles')->where('name', 'imc_qa_checker')->update([
                'display_name' => 'Integrated Marketing Communications',
                'description' => 'Final quality and branding gate before publishing (Stage 3).',
                'updated_at' => now(),
            ]);
            $imcRoleId = $existingRole->id;
        } else {
            $roleData['created_at'] = now();
            $imcRoleId = DB::table('roles')->insertGetId($roleData);
        }

        // 2. Ensure Department is 'Integrated Marketing Communications'
        $dept = Department::where('display_name', 'Integrated Marketing Communications')->first();
        if (!$dept) {
            $dept = Department::where('name', 'ILIKE', '%Integrated Marketing%')
                ->orWhere('display_name', 'ILIKE', '%Integrated Marketing%')
                ->orWhere('name', 'ILIKE', '%Institutional Marketing%')
                ->orWhere('display_name', 'ILIKE', '%Institutional Marketing%')
                ->orWhere('name', 'ILIKE', '%IMC%')
                ->orWhere('display_name', 'ILIKE', '%IMC%')
                ->first();

            if ($dept) {
                $dept->update([
                    'name' => 'Integrated Marketing Communications',
                    'display_name' => 'Integrated Marketing Communications',
                    'is_system' => true,
                ]);
            } else {
                $dept = Department::create([
                    'name' => 'Integrated Marketing Communications',
                    'display_name' => 'Integrated Marketing Communications',
                    'is_system' => true,
                    'role_categories' => ['approver'],
                ]);
            }
        }

        // 3. Update any user belonging to IMC / Integrated Marketing / Rafael
        $users = User::where(function ($q) {
            $q->where('department', 'ILIKE', '%Integrated Marketing%')
              ->orWhere('department', 'ILIKE', '%Institutional Marketing%')
              ->orWhere('department', 'ILIKE', '%Marketing Communication%')
              ->orWhere('department', 'ILIKE', '%IMC%')
              ->orWhere('first_name', 'ILIKE', '%Rafael%')
              ->orWhere('last_name', 'ILIKE', '%Eniola%');
        })->get();

        foreach ($users as $user) {
            if (!$user->hasRole('admin') && !$user->hasRole('it_admin')) {
                $user->department = 'Integrated Marketing Communications';
                $user->position = 'Integrated Marketing Communications';
                $user->save();

                // Direct pivot sync to guarantee role assignment in model_has_roles
                DB::table('model_has_roles')
                    ->where('model_type', User::class)
                    ->where('model_id', $user->id)
                    ->whereIn('role_id', function ($query) {
                        $query->select('id')->from('roles')->whereIn('name', ['office_head', 'approver']);
                    })
                    ->delete();

                $hasImcRole = DB::table('model_has_roles')
                    ->where('model_type', User::class)
                    ->where('model_id', $user->id)
                    ->where('role_id', $imcRoleId)
                    ->exists();

                if (!$hasImcRole) {
                    DB::table('model_has_roles')->insert([
                        'role_id' => $imcRoleId,
                        'model_type' => User::class,
                        'model_id' => $user->id,
                    ]);
                }
            }
        }

        // 4. Backfill any existing imc_qa approval workflow rows
        $imcUser = User::role('imc_qa_checker')->where('status', 'active')->first()
            ?? User::where('department', 'Integrated Marketing Communications')->where('status', 'active')->first();

        if ($imcUser) {
            ApprovalWorkflow::where('stage', 'imc_qa')
                ->where(function ($q) {
                    $q->whereNull('approver_id')
                      ->orWhere('approver_id', 0);
                })
                ->update(['approver_id' => $imcUser->id]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
