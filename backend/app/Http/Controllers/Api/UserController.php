<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\UserResource;
use App\Models\Department;
use App\Models\User;
use App\Notifications\AccountCreatedCredentialsNotification;
use App\Services\AuditLogService;
use App\Services\ExcelTemplateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class UserController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        // For simple setup, we just return all users ordered by creation date
        $users = User::with('roles')->orderBy('created_at', 'desc')->get();
        return response()->json([
            'data' => UserResource::collection($users)
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'employee_id' => 'required|string|max:50|unique:users,employee_id',
            'first_name' => 'required|string|max:255',
            'middle_name' => 'nullable|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => ['required', 'email', 'max:255', 'unique:users,email', 'regex:/@jmc\.edu\.ph$/i'],
            'password' => 'required|string',
            'department' => 'nullable|string|max:255',
            'position' => 'nullable|string|max:255',
            'role' => 'required|string|exists:roles,name',
            'program_head_id' => 'nullable|integer|exists:program_heads,id',
        ], [
            'first_name.required' => 'Please fill the Firstname.',
            'last_name.required' => 'Please fill the Lastname.',
            'email.required' => 'Please fill the Email Username.',
            'email.regex' => 'Only @jmc.edu.ph email addresses are allowed.',
            'password.required' => 'Please fill the Password.',
            'role.required' => 'Please select the Role.',
        ]);

        $dept = $validated['department'] ?? null;
        $role = $validated['role'];
        $position = $validated['position'] ?? null;
        if (!$position || str_contains(strtolower($position), 'staff') || str_contains(strtolower($position), 'faculty')) {
            $category = match ($role) {
                'it_publisher', 'it_admin' => 'admin',
                'office_head', 'vice_president', 'imc_qa_checker' => 'approver',
                default => 'requestor',
            };
            if ($role === 'office_head') {
                $position = 'Department Head';
            } elseif ($role === 'vice_president') {
                $position = 'Vice President';
            } elseif ($role === 'imc_qa_checker') {
                $position = 'QA / Branding Checker';
            } elseif ($category === 'approver') {
                $position = 'Approver';
            } elseif ($category === 'admin') {
                $position = 'IT Administrator';
            } else {
                $position = 'Requestor';
            }
        }

        $user = User::create([
            'employee_id' => $validated['employee_id'],
            'first_name' => trim($validated['first_name']),
            'middle_name' => !empty($validated['middle_name']) ? trim($validated['middle_name']) : null,
            'last_name' => trim($validated['last_name']),
            'email' => strtolower(trim($validated['email'])),
            'password' => Hash::make(trim($validated['password'])),
            'department' => $dept,
            'program_head_id' => $validated['program_head_id'] ?? null,
            'position' => $position,
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $user->syncRoles([$validated['role']]);

        if (!empty($validated['program_head_id'])) {
            $user->update(['program_head_id' => $validated['program_head_id']]);
            if ($validated['role'] === 'office_head') {
                \App\Models\ProgramHead::where('id', $validated['program_head_id'])->update(['user_id' => $user->id]);
            }
        }

        AuditLogService::log('USER_CREATED', 'Created institutional account: ' . $user->full_name, 'INFO', [
            'target_user_id' => $user->id,
            'email' => $user->email,
            'role' => $validated['role'],
            'department' => $dept,
        ], $request);

        // Send Welcome & Credentials Email to the user's institutional inbox
        try {
            $user->notify(new AccountCreatedCredentialsNotification($user, $validated['password'], $validated['role']));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("Failed to dispatch welcome email to {$user->email}: " . $e->getMessage());
        }

        return response()->json([
            'data' => new UserResource($user->load(['roles', 'programHead']))
        ], 201);
    }

    /**
     * Bulk store newly created resources from CSV/Excel import.
     */
    public function bulkStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'users' => 'required|array|min:1',
            'users.*.first_name' => 'required|string|max:255',
            'users.*.last_name' => 'required|string|max:255',
            'users.*.email' => 'required|string|max:255',
            'users.*.password' => 'nullable|string',
            'users.*.role' => 'nullable|string',
            'users.*.department' => 'nullable|string|max:255',
            'users.*.position' => 'nullable|string|max:255',
        ]);

        $created = [];
        $errors = [];

        foreach ($validated['users'] as $index => $userData) {
            $rowNum = $index + 1;
            $rawEmail = trim($userData['email'] ?? '');
            if (!str_contains($rawEmail, '@')) {
                $rawEmail .= '@jmc.edu.ph';
            }
            $email = strtolower($rawEmail);

            if (!str_ends_with($email, '@jmc.edu.ph')) {
                $errors[] = "Row {$rowNum}: Email '{$email}' must end with @jmc.edu.ph.";
                continue;
            }

            $dept = !empty($userData['department']) ? trim($userData['department']) : null;
            $rawRole = !empty($userData['role']) ? trim($userData['role']) : 'requestor';
            $role = match (strtolower($rawRole)) {
                'admin', 'administrator', 'it_admin' => 'it_admin',
                'publisher', 'it_publisher' => 'it_publisher',
                'approver' => match (true) {
                    str_contains(strtolower($dept ?? ''), 'marketing') || str_contains(strtolower($dept ?? ''), 'imc') => 'imc_qa_checker',
                    str_contains(strtolower($dept ?? ''), 'president') || str_contains(strtolower($dept ?? ''), 'vpaa') || str_contains(strtolower($dept ?? ''), 'vice') => 'vice_president',
                    default => 'office_head',
                },
                'office_head', 'office head', 'department_head', 'department head', 'dean' => 'office_head',
                'vice_president', 'vice president', 'vp' => 'vice_president',
                'imc_qa', 'imc_qa_checker', 'qa' => 'imc_qa_checker',
                default => 'requestor',
            };

            $category = match ($role) {
                'it_publisher', 'it_admin' => 'admin',
                'office_head', 'vice_president', 'imc_qa_checker' => 'approver',
                default => 'requestor',
            };

            if ($dept) {
                $deptRecord = Department::where('display_name', $dept)->orWhere('name', $dept)->first();
                if ($deptRecord && !empty($deptRecord->role_categories)) {
                    $deptCats = array_map('strtolower', (array) $deptRecord->role_categories);
                    if (!in_array($category, $deptCats, true)) {
                        $errors[] = "Row {$rowNum}: Department '{$dept}' is not assigned to role '{$rawRole}'.";
                        continue;
                    }
                }
            }

            $position = !empty($userData['position']) ? trim($userData['position']) : null;

            if (!$position || str_contains(strtolower($position), 'staff') || str_contains(strtolower($position), 'faculty')) {
                if ($category === 'approver') {
                    $position = 'Approver';
                } elseif ($category === 'admin') {
                    $position = 'IT Administrator';
                } else {
                    $position = 'Requestor';
                }
            }

            $rawPassword = !empty($userData['password']) ? trim((string)$userData['password']) : 'Jmcfi@2026';
            $hashedPassword = Hash::make($rawPassword);

            try {
                // If user with this email already exists, update their record and credentials
                $existingUser = User::whereRaw('LOWER(email) = ?', [$email])->first();
                if ($existingUser) {
                    $existingUser->update([
                        'first_name' => trim($userData['first_name']),
                        'middle_name' => !empty($userData['middle_name']) ? trim($userData['middle_name']) : $existingUser->middle_name,
                        'last_name' => trim($userData['last_name']),
                        'email' => $email,
                        'password' => $hashedPassword,
                        'department' => $dept,
                        'position' => $position,
                        'status' => 'active',
                        'email_verified_at' => $existingUser->email_verified_at ?: now(),
                    ]);
                    $existingUser->syncRoles([$role]);
                    $existingUser->load('roles');
                    $created[] = $existingUser;
                } else {
                    // Auto-generate unique employee ID
                    do {
                        $empId = 'EMP-' . str_pad((string) mt_rand(10000, 99999), 5, '0', STR_PAD_LEFT);
                    } while (User::where('employee_id', $empId)->exists());

                    $user = User::create([
                        'employee_id' => $empId,
                        'first_name' => trim($userData['first_name']),
                        'middle_name' => !empty($userData['middle_name']) ? trim($userData['middle_name']) : null,
                        'last_name' => trim($userData['last_name']),
                        'email' => $email,
                        'password' => $hashedPassword,
                        'department' => $dept,
                        'position' => $position,
                        'status' => 'active',
                        'email_verified_at' => now(),
                    ]);

                    $user->syncRoles([$role]);
                    $user->load('roles');
                    $created[] = $user;
                }

                // Send Welcome & Credentials Email to user's institutional email
                try {
                    $notifiableUser = $existingUser ?? $user;
                    $notifiableUser->notify(new AccountCreatedCredentialsNotification($notifiableUser, $rawPassword, $role));
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning("Failed to dispatch welcome email to {$email}: " . $e->getMessage());
                }
            } catch (\Exception $e) {
                $errors[] = "Row {$rowNum} ({$email}): " . $e->getMessage();
            }
        }

        if (count($created) > 0) {
            AuditLogService::log(
                'USERS_BULK_IMPORTED',
                'Bulk imported ' . count($created) . ' institutional accounts via spreadsheet',
                'INFO',
                ['count' => count($created), 'errors_count' => count($errors)],
                $request
            );
        }

        $statusCode = count($created) > 0 ? 200 : (count($errors) > 0 ? 422 : 200);
        $message = count($created) > 0
            ? 'Successfully imported ' . count($created) . ' accounts.' . (count($errors) > 0 ? ' (' . count($errors) . ' rows skipped)' : '')
            : (count($errors) > 0 ? 'Failed to import accounts: ' . implode('; ', $errors) : 'No accounts were imported.');

        return response()->json([
            'message' => $message,
            'created_count' => count($created),
            'data' => UserResource::collection(new \Illuminate\Database\Eloquent\Collection($created)),
            'errors' => $errors,
        ], $statusCode);
    }

    /**
     * Display the specified resource.
     */
    public function show(User $user): JsonResponse
    {
        return response()->json([
            'data' => new UserResource($user->load('roles'))
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => 'sometimes|string|max:255',
            'middle_name' => 'nullable|string|max:255',
            'last_name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', 'max:255', 'unique:users,email,' . $user->id, 'regex:/@jmc\.edu\.ph$/i'],
            'phone' => 'nullable|string|max:20',
            'position' => 'nullable|string|max:255',
            'department' => 'nullable|string|max:255',
            'role' => 'sometimes|string|exists:roles,name',
            'status' => 'sometimes|string|in:active,inactive',
            'password' => 'sometimes|string|confirmed',
            'program_head_id' => 'nullable|integer|exists:program_heads,id',
        ], [
            'email.regex' => 'Only @jmc.edu.ph email addresses are allowed.',
        ]);

        // `role` is not a users column (roles live in the Spatie pivot table and
        // are synced below via syncRoles), and `password` is assigned explicitly
        // after fill — so exclude both from mass assignment. Including `role`
        // here throws a MassAssignmentException because it is not $fillable.
        $user->fill(Arr::except($validated, ['role', 'password']));

        if ($request->has('password')) {
            $user->password = $validated['password'];
        }

        if ($request->has('program_head_id')) {
            $user->program_head_id = $request->input('program_head_id');
            if ($user->hasRole('office_head') && $user->program_head_id) {
                \App\Models\ProgramHead::where('id', $user->program_head_id)->update(['user_id' => $user->id]);
            }
        }

        $user->save();

        if ($request->has('role')) {
            $user->syncRoles([$validated['role']]);
            if (!$request->has('position')) {
                $category = match ($validated['role']) {
                    'it_publisher', 'it_admin' => 'admin',
                    'office_head', 'vice_president', 'imc_qa_checker' => 'approver',
                    default => 'requestor',
                };
                if ($category === 'approver') {
                    $user->position = 'Approver';
                } elseif ($category === 'admin') {
                    $user->position = 'IT Administrator';
                } else {
                    $user->position = 'Requestor';
                }
                $user->save();
            }
        }

        AuditLogService::log('USER_UPDATED', 'Updated institutional account: ' . $user->full_name, 'INFO', [
            'target_user_id' => $user->id,
            'email' => $user->email,
            'fields' => array_keys(Arr::except($validated, ['password', 'password_confirmation'])),
            'password_changed' => $request->has('password'),
        ], $request);

        return response()->json([
            'data' => new UserResource($user->load(['roles', 'programHead']))
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(User $user): JsonResponse
    {
        // Don't allow user to delete themselves
        if (request()->user()->id === $user->id) {
            return response()->json(['message' => 'Cannot delete your own account'], 400);
        }

        try {
            $deleted = [
                'target_user_id' => $user->id,
                'email' => $user->email,
                'name' => $user->full_name,
            ];

            $adminId = request()->user()->id;
            \Illuminate\Support\Facades\DB::transaction(function () use ($user, $adminId) {
                \App\Models\PostRequest::where('requestor_id', $user->id)->update(['requestor_id' => $adminId]);
                \Illuminate\Support\Facades\DB::table('approval_workflows')->where('approver_id', $user->id)->delete();
                \Illuminate\Support\Facades\DB::table('policy_violations')->where('user_id', $user->id)->delete();
                \Illuminate\Support\Facades\DB::table('publishing_records')->where('published_by', $user->id)->update(['published_by' => $adminId]);
                $user->delete();
            });

            AuditLogService::log('USER_DELETED', 'Deleted institutional account: ' . $deleted['name'], 'WARNING', $deleted, request());
            return response()->json(null, 204);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete user: ' . $e->getMessage()
            ], 400);
        }
    }

    /**
     * Get all available roles
     */
    public function getRoles(): JsonResponse
    {
        $roles = Role::all();
        return response()->json([
            'data' => $roles
        ]);
    }

    /**
     * Download dynamic Excel template with system-synchronized dependent dropdowns
     */
    public function downloadTemplate(Request $request): BinaryFileResponse
    {
        // If frontend passes new departments to sync, update and regenerate
        if ($request->has('departments') && is_array($request->input('departments')) && count($request->input('departments')) > 0) {
            $changed = false;
            foreach ($request->input('departments') as $deptData) {
                $name = is_string($deptData) ? trim($deptData) : trim($deptData['display_name'] ?? $deptData['name'] ?? '');
                if (!empty($name)) {
                    $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '_', $name));
                    $cats = is_array($deptData) && !empty($deptData['role_categories'])
                        ? (array) $deptData['role_categories']
                        : ['requestor', 'approver'];
                    $dept = \App\Models\Department::firstOrCreate(
                        ['display_name' => $name],
                        [
                            'name' => $slug,
                            'is_active' => true,
                            'is_system' => false,
                            'role_categories' => $cats,
                        ]
                    );
                    if ($dept->wasRecentlyCreated) {
                        $changed = true;
                    }
                }
            }
            if ($changed) {
                ExcelTemplateService::generateTemplate(null, true);
            }
        }

        $path = ExcelTemplateService::getTemplatePath();
        return response()->download($path, 'jmcfi_user_accounts_template.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }
}
