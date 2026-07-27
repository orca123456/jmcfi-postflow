<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        $roles = Role::orderBy('display_name')->get();
        return response()->json([
            'data' => $roles->map(fn($r) => [
                'id' => $r->id,
                'name' => $r->name,
                'display_name' => $r->display_name,
                'description' => $r->description,
                'permissions' => $r->permissions,
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:roles,name',
            'display_name' => 'required|string|max:200',
            'description' => 'nullable|string|max:500',
        ]);

        $role = Role::create([
            'name' => $validated['name'],
            'guard_name' => 'web',
            'display_name' => $validated['display_name'],
            'description' => $validated['description'] ?? null,
            'permissions' => [],
        ]);

        return response()->json([
            'data' => $role,
        ], 201);
    }

    public function destroy(Role $role): JsonResponse
    {


        $role->delete();
        return response()->json(null, 204);
    }
}
