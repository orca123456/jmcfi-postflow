<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\ProgramHead;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProgramHeadController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ProgramHead::with(['department', 'user'])
            ->orderBy('order_index', 'asc')
            ->orderBy('name', 'asc');

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->input('department_id'));
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    public function byDepartment(Department $department): JsonResponse
    {
        $programHeads = $department->programHeads()
            ->with('user')
            ->orderBy('order_index', 'asc')
            ->get();

        return response()->json([
            'data' => $programHeads,
            'department' => $department,
        ]);
    }

    public function store(Request $request, ?Department $department = null): JsonResponse
    {
        $deptId = $department ? $department->id : $request->input('department_id');

        $validated = $request->validate([
            'department_id' => $department ? 'nullable|exists:departments,id' : 'required|exists:departments,id',
            'user_id' => 'nullable|exists:users,id',
            'name' => 'required|string|max:200',
            'program_name' => 'required|string|max:200',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:50',
            'order_index' => 'nullable|integer|min:1|max:20',
            'is_active' => 'nullable|boolean',
        ], [
            'name.required' => 'Program Head name is required.',
            'program_name.required' => 'Assigned Program / Major is required.',
        ]);

        $targetDeptId = $deptId ?? $validated['department_id'];

        if (!isset($validated['order_index']) || empty($validated['order_index'])) {
            $taken = ProgramHead::where('department_id', $targetDeptId)->pluck('order_index')->toArray();
            $order = 1;
            while (in_array($order, $taken)) {
                $order++;
            }
            $validated['order_index'] = $order;
        } else {
            $existing = ProgramHead::where('department_id', $targetDeptId)
                ->where('order_index', (int) $validated['order_index'])
                ->first();
            if ($existing) {
                return response()->json([
                    'message' => "Hierarchy order {$validated['order_index']} is already assigned to '{$existing->name}'.",
                    'errors' => ['order_index' => ["Hierarchy order {$validated['order_index']} is already assigned."]],
                ], 422);
            }
        }

        $programHead = ProgramHead::create([
            'department_id' => $targetDeptId,
            'user_id' => $validated['user_id'] ?? null,
            'name' => $validated['name'],
            'program_name' => $validated['program_name'],
            'email' => $validated['email'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'order_index' => (int) $validated['order_index'],
            'is_active' => $validated['is_active'] ?? true,
        ]);

        AuditLogService::log(
            'PROGRAM_HEAD_CREATED',
            "Assigned program head '{$programHead->name}' to department ID {$programHead->department_id}.",
            'INFO',
            $programHead->toArray(),
            $request
        );

        return response()->json([
            'message' => 'Program Head created successfully.',
            'data' => $programHead->load(['department', 'user']),
        ], 201);
    }

    public function update(Request $request, ProgramHead $programHead): JsonResponse
    {
        $validated = $request->validate([
            'department_id' => 'sometimes|exists:departments,id',
            'user_id' => 'nullable|exists:users,id',
            'name' => 'sometimes|required|string|max:200',
            'program_name' => 'sometimes|required|string|max:200',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:50',
            'order_index' => 'sometimes|integer|min:1|max:20',
            'is_active' => 'sometimes|boolean',
        ], [
            'name.required' => 'Program Head name is required.',
            'program_name.required' => 'Assigned Program / Major is required.',
        ]);

        if (isset($validated['order_index']) && (int) $validated['order_index'] !== (int) $programHead->order_index) {
            $targetDeptId = $validated['department_id'] ?? $programHead->department_id;
            $existing = ProgramHead::where('department_id', $targetDeptId)
                ->where('id', '!=', $programHead->id)
                ->where('order_index', (int) $validated['order_index'])
                ->first();
            if ($existing) {
                return response()->json([
                    'message' => "Hierarchy order {$validated['order_index']} is already assigned to '{$existing->name}'.",
                    'errors' => ['order_index' => ["Hierarchy order {$validated['order_index']} is already assigned."]],
                ], 422);
            }
        }

        $oldValues = $programHead->toArray();
        $programHead->update($validated);

        if (!empty($programHead->user_id)) {
            $linkedUser = \App\Models\User::find($programHead->user_id);
            if ($linkedUser) {
                $linkedUser->update([
                    'position' => "{$programHead->program_name} Program Head"
                ]);
            }
        }

        AuditLogService::log(
            'PROGRAM_HEAD_UPDATED',
            "Updated program head '{$programHead->name}' (ID: {$programHead->id}).",
            'INFO',
            ['old' => $oldValues, 'new' => $programHead->fresh()->toArray()],
            $request
        );

        return response()->json([
            'message' => 'Program Head updated successfully.',
            'data' => $programHead->fresh()->load(['department', 'user']),
        ]);
    }

    public function destroy(Request $request, ProgramHead $programHead): JsonResponse
    {
        $oldValues = $programHead->toArray();
        $programHead->delete();

        AuditLogService::log(
            'PROGRAM_HEAD_DELETED',
            "Removed program head '{$programHead->name}' (ID: {$programHead->id}).",
            'WARNING',
            $oldValues,
            $request
        );

        return response()->json([
            'message' => 'Program Head deleted successfully.',
        ]);
    }
}
