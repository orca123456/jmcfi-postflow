<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Services\AuditLogService;
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

        AuditLogService::log('DEPARTMENT_CREATED', 'Created department: ' . $department->display_name, 'INFO', [
            'department_id' => $department->id,
            'role_categories' => $categories,
        ], $request);

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

        AuditLogService::log('DEPARTMENT_UPDATED', 'Updated department: ' . $department->display_name, 'INFO', [
            'department_id' => $department->id,
            'fields' => array_keys($validated),
        ], $request);

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
                AuditLogService::log('DEPARTMENT_UPDATED', 'Removed role access from department: ' . $department->display_name, 'WARNING', [
                    'department_id' => $department->id,
                    'removed_role_category' => $roleCategory,
                ], $request);
                return response()->json(['data' => $department]);
            }
        }

        // No role scope, or this was the last role using it -> delete the row.
        $deletedName = $department->display_name;
        $deletedId = $department->id;
        $department->delete();
        AuditLogService::log('DEPARTMENT_DELETED', 'Deleted department: ' . $deletedName, 'WARNING', [
            'department_id' => $deletedId,
        ], $request);
        return response()->json(null, 204);
    }

    public function uploadLogo(Request $request, Department $department): JsonResponse
    {
        $request->validate([
            'logo' => 'required|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        // Delete old logo if exists
        $disk = config('filesystems.default') === 'local' ? 'public' : config('filesystems.default');
        if ($department->logo_path && Storage::disk($disk)->exists($department->logo_path)) {
            Storage::disk($disk)->delete($department->logo_path);
        }

        $disk = config('filesystems.default') === 'local' ? 'public' : config('filesystems.default');
        $path = $request->file('logo')->store('department-logos', $disk);
        $department->update(['logo_path' => $path]);

        AuditLogService::log('DEPARTMENT_LOGO_UPDATED', 'Updated department logo: ' . $department->display_name, 'INFO', [
            'department_id' => $department->id,
        ], $request);

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

        AuditLogService::log('DEPARTMENT_LOGO_REMOVED', 'Removed department logo: ' . $department->display_name, 'INFO', [
            'department_id' => $department->id,
        ]);

        return response()->json(['message' => 'Logo removed.']);
    }
}
