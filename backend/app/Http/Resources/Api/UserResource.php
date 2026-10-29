<?php

namespace App\Http\Resources\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $linkedProgramHead = $this->programHead ?: \App\Models\ProgramHead::where('user_id', $this->id)->first();

        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'first_name' => $this->first_name,
            'middle_name' => $this->middle_name,
            'last_name' => $this->last_name,
            'full_name' => $this->full_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'department' => $this->department,
            'position' => $this->position,
            'status' => $this->status,
            'photo_url' => $this->photo_url,
            'department_logo_url' => $this->department_logo_url,
            'program_head_id' => $this->program_head_id ?: $linkedProgramHead?->id,
            'assigned_program' => $this->assigned_program ?: $linkedProgramHead?->program_name,
            'program_head' => $linkedProgramHead ? [
                'id' => $linkedProgramHead->id,
                'name' => $linkedProgramHead->name,
                'program_name' => $linkedProgramHead->program_name,
                'order_index' => $linkedProgramHead->order_index,
                'order_label' => $linkedProgramHead->order_label,
            ] : null,
            'roles' => $this->whenLoaded('roles', function () {
                $roles = $this->roles->pluck('name')->toArray();
                $wfRole = $this->workflowRole();
                if ($wfRole && !in_array($wfRole, $roles, true)) {
                    array_unshift($roles, $wfRole);
                }
                return $roles;
            }, function () {
                $wfRole = $this->workflowRole();
                return $wfRole ? [$wfRole] : [];
            }),
            'role' => $this->workflowRole(),
            'permissions' => $this->whenLoaded('permissions', function () {
                return $this->getAllPermissions()->pluck('name');
            }),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
