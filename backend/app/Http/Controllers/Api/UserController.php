<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\UserResource;
use App\Models\User;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

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
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
            'department' => 'nullable|string|max:255',
            'position' => 'nullable|string|max:255',
            'role' => 'required|string|exists:roles,name',
        ]);

        // Auto-set position based on role category (mirrors User::roleCategory)
        $dept = $validated['department'] ?? null;
        $role = $validated['role'];
        $position = $validated['position'] ?? null;
        if (!$position) {
            $category = match ($role) {
                'it_publisher', 'it_admin' => 'admin',
                'office_head', 'vice_president', 'imc_qa_checker' => 'approver',
                default => 'requestor',
            };
            if ($category === 'approver') {
                $position = match ($role) {
                    'vice_president' => 'Vice President',
                    'imc_qa_checker' => 'QA / Branding Checker',
                    default => 'Department Head',
                };
            } elseif ($category === 'admin') {
                $position = 'IT Administrator';
            }
        }

        $user = User::create([
            'employee_id' => $validated['employee_id'],
            'first_name' => $validated['first_name'],
            'middle_name' => $validated['middle_name'] ?? null,
            'last_name' => $validated['last_name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
            'department' => $dept,
            'position' => $position,
            'status' => 'active',
        ]);

        $user->assignRole($validated['role']);

        AuditLogService::log('USER_CREATED', 'Created institutional account: ' . $user->full_name, 'INFO', [
            'target_user_id' => $user->id,
            'email' => $user->email,
            'role' => $validated['role'],
            'department' => $dept,
        ], $request);

        return response()->json([
            'data' => new UserResource($user->load('roles'))
        ], 201);
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
            'email' => 'sometimes|email|max:255|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|max:20',
            'position' => 'nullable|string|max:255',
            'department' => 'nullable|string|max:255',
            'role' => 'sometimes|string|exists:roles,name',
            'status' => 'sometimes|string|in:active,inactive',
            'password' => 'sometimes|string|min:8|confirmed',
        ]);

        // `role` is not a users column (roles live in the Spatie pivot table and
        // are synced below via syncRoles), and `password` is assigned explicitly
        // after fill — so exclude both from mass assignment. Including `role`
        // here throws a MassAssignmentException because it is not $fillable.
        $user->fill(Arr::except($validated, ['role', 'password']));

        if ($request->has('password')) {
            $user->password = $validated['password'];
        }

        $user->save();

        if ($request->has('role')) {
            $user->syncRoles([$validated['role']]);
        }

        AuditLogService::log('USER_UPDATED', 'Updated institutional account: ' . $user->full_name, 'INFO', [
            'target_user_id' => $user->id,
            'email' => $user->email,
            'fields' => array_keys(Arr::except($validated, ['password', 'password_confirmation'])),
            'password_changed' => $request->has('password'),
        ], $request);

        return response()->json([
            'data' => new UserResource($user->load('roles'))
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
            $user->delete();
            AuditLogService::log('USER_DELETED', 'Deleted institutional account: ' . $deleted['name'], 'WARNING', $deleted);
            return response()->json(null, 204);
        } catch (\Illuminate\Database\QueryException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete this user because they are associated with existing content or approvals.'
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
}
