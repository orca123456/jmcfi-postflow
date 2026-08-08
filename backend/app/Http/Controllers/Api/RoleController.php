<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    // Only these 3 roles are allowed in the system
    const ALLOWED_ROLES = ['requestor', 'approver', 'admin'];

    public function index(): JsonResponse
    {
        $roles = Role::whereIn('name', self::ALLOWED_ROLES)->orderBy('display_name')->get();
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
        return response()->json(['message' => 'Roles are fixed and cannot be added.'], 403);
    }

    public function destroy(Role $role): JsonResponse
    {
        return response()->json(['message' => 'Roles are fixed and cannot be deleted.'], 403);
    }
}
