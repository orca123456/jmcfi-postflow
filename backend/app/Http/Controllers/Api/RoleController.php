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
        // Return all real roles from the DB (office_head, vice_president,
        // imc_qa_checker, it_publisher, content_requestor, requestor).
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
        return response()->json(['message' => 'Roles are fixed and cannot be added.'], 403);
    }

    public function destroy(Role $role): JsonResponse
    {
        return response()->json(['message' => 'Roles are fixed and cannot be deleted.'], 403);
    }
}
