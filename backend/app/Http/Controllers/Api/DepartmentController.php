<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class DepartmentController extends Controller
{
    public function index(): JsonResponse
    {
        $departments = Department::orderBy('display_name')->get();
        return response()->json([
            'data' => $departments,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'required', 'string', 'max:100',
                \Illuminate\Validation\Rule::unique('departments')->whereNull('deleted_at')
            ],
            'display_name' => 'required|string|max:200',
            'description' => 'nullable|string|max:500',
            'role_categories' => 'nullable|array',
            'role_categories.*' => 'in:admin,approver,requestor',
        ]);
        // College departments are shared between requestor and approver.
        // Only 'admin' departments stay role-exclusive.
        $categories = $validated['role_categories'] ?? [];
        if (!in_array('admin', $categories, true)) {
            $categories = ['requestor', 'approver'];
        }

        $department = Department::create([
            'name' => $validated['name'],
            'display_name' => $validated['display_name'],
            'description' => $validated['description'] ?? null,
            'is_active' => true,
            'role_categories' => $categories,
        ]);

        return response()->json([
            'data' => $department,
        ], 201);
    }

    public function update(Request $request, Department $department): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'sometimes', 'string', 'max:100',
                \Illuminate\Validation\Rule::unique('departments')->ignore($department->id)->whereNull('deleted_at')
            ],
            'display_name' => 'sometimes|string|max:200',
            'description' => 'nullable|string|max:500',
            'is_active' => 'sometimes|boolean',
            'role_categories' => 'nullable|array',
            'role_categories.*' => 'in:admin,approver,requestor',
        ]);

        $department->update($validated);

        return response()->json([
            'data' => $department,
        ]);
    }

    public function destroy(Request $request, Department $department): JsonResponse
    {
        // Built-in system departments cannot be removed
        if ($department->is_system) {
            return response()->json([
                'message' => 'This is a built-in system department and cannot be removed.',
            ], 403);
        }

        // Role-scoped delete: if a role_category is provided, only detach that
        // role from the department. It stays available for other roles that
        // share it (e.g. a college used by both Requestor and Approver).
        $roleCategory = $request->query('role_category');
        if (in_array($roleCategory, ['admin', 'approver', 'requestor'], true)) {
            $categories = $department->role_categories ?? [];
            $categories = array_values(array_filter($categories, fn($c) => $c !== $roleCategory));
            if (count($categories) > 0) {
                $department->update(['role_categories' => $categories]);
                return response()->json(['data' => $department]);
            }
        }

        // No role scope, or this was the last role using it -> delete the row.
        $department->delete();
        return response()->json(null, 204);
    }

    public function uploadLogo(Request $request, Department $department): JsonResponse
    {
        $request->validate([
            'logo' => 'required|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        // Delete old logo if exists
        if ($department->logo_path && Storage::disk('public')->exists($department->logo_path)) {
            Storage::disk('public')->delete($department->logo_path);
        }

        $path = $request->file('logo')->store('department-logos', 'public');
        $department->update(['logo_path' => $path]);

        return response()->json([
            'data' => $department,
            'logo_url' => asset('storage/' . $path),
        ]);
    }

    public function removeLogo(Department $department): JsonResponse
    {
        if ($department->logo_path && Storage::disk('public')->exists($department->logo_path)) {
            Storage::disk('public')->delete($department->logo_path);
        }
        $department->update(['logo_path' => null]);

        return response()->json(['message' => 'Logo removed.']);
    }
}
