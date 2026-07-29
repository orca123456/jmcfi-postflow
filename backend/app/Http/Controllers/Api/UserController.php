<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
            'role' => 'required|string|exists:roles,name',
        ]);

        $user = User::create([
            'employee_id' => $validated['employee_id'],
            'first_name' => $validated['first_name'],
            'middle_name' => $validated['middle_name'] ?? null,
            'last_name' => $validated['last_name'],
            'email' => $validated['email'],
            'password' => $validated['password'], // Hashed automatically by model's 'hashed' cast
            'department' => $validated['department'] ?? null,
            'status' => 'active',
        ]);

        $user->assignRole($validated['role']);

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

        $user->fill($validated);

        if ($request->has('password')) {
            $user->password = $validated['password'];
        }

        $user->save();

        if ($request->has('role')) {
            $user->syncRoles([$validated['role']]);
        }

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
        if (auth()->id() === $user->id) {
            return response()->json(['message' => 'Cannot delete your own account'], 400);
        }

        try {
            $user->delete();
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
