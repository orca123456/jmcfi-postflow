<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
            'name' => 'required|string|max:100|unique:departments,name',
            'display_name' => 'required|string|max:200',
            'description' => 'nullable|string|max:500',
        ]);

        $department = Department::create([
            'name' => $validated['name'],
            'display_name' => $validated['display_name'],
            'description' => $validated['description'] ?? null,
            'is_active' => true,
        ]);

        return response()->json([
            'data' => $department,
        ], 201);
    }

    public function update(Request $request, Department $department): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:100|unique:departments,name,' . $department->id,
            'display_name' => 'sometimes|string|max:200',
            'description' => 'nullable|string|max:500',
            'is_active' => 'sometimes|boolean',
        ]);

        $department->update($validated);

        return response()->json([
            'data' => $department,
        ]);
    }

    public function destroy(Department $department): JsonResponse
    {
        $department->delete();
        return response()->json(null, 204);
    }

    public function uploadLogo(Request $request, Department $department): JsonResponse
    {
        $request->validate([
            'logo' => 'required|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        // Delete old logo if exists
        if ($department->logo_path && \Storage::disk('public')->exists($department->logo_path)) {
            \Storage::disk('public')->delete($department->logo_path);
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
        if ($department->logo_path && \Storage::disk('public')->exists($department->logo_path)) {
            \Storage::disk('public')->delete($department->logo_path);
        }
        $department->update(['logo_path' => null]);

        return response()->json(['message' => 'Logo removed.']);
    }
}
