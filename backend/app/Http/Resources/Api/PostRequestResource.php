<?php

namespace App\Http\Resources\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PostRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'caption_narrative' => $this->caption_narrative,
            'category' => $this->whenLoaded('category', function () {
                return [
                    'id' => $this->category->id,
                    'name' => $this->category->name,
                    'slug' => $this->category->slug,
                    'color' => $this->category->color,
                    'icon' => $this->category->icon,
                ];
            }),
            'requestor' => $this->whenLoaded('requestor', function () {
                return [
                    'id' => $this->requestor->id,
                    'full_name' => $this->requestor->full_name,
                    'email' => $this->requestor->email,
                    'department' => $this->requestor->department,
                ];
            }),
            'status' => $this->status,
            'status_label' => $this->status_label,
            'target_platforms' => $this->target_platforms ?? [],
            'preferred_schedule_at' => $this->preferred_schedule_at?->toISOString(),
            'published_at' => $this->published_at?->toISOString(),
            'rejection_reason' => $this->rejection_reason,
            'revision_notes' => $this->revision_notes ?? [],
            'revision_count' => $this->revision_count,
            'media' => $this->whenLoaded('media', function () {
                return $this->media->map(function ($media) {
                    return [
                        'id' => $media->id,
                        'type' => $media->type,
                        'original_filename' => $media->original_filename,
                        'url' => $media->url,
                        'mime_type' => $media->mime_type,
                        'size' => $media->size,
                        'formatted_size' => $media->formatted_size,
                        'is_featured' => $media->is_featured,
                        'sort_order' => $media->sort_order,
                    ];
                });
            }),
            'approval_workflows' => $this->whenLoaded('approvalWorkflows', function () {
                return $this->approvalWorkflows->map(function ($workflow) {
                    return [
                        'id' => $workflow->id,
                        'stage' => $workflow->stage,
                        'stage_label' => $workflow->stage_label,
                        'action' => $workflow->action,
                        'action_label' => $workflow->action_label,
                        'approver' => $workflow->approver ? [
                            'id' => $workflow->approver->id,
                            'full_name' => $workflow->approver->full_name,
                            'email' => $workflow->approver->email,
                        ] : null,
                        'remarks' => $workflow->remarks,
                        'acted_at' => $workflow->acted_at?->toISOString(),
                        'stage_order' => $workflow->stage_order,
                    ];
                });
            }),
            'ai_compliance_check' => $this->whenLoaded('aiComplianceCheck', function () {
                $check = $this->aiComplianceCheck;
                return [
                    'id' => $check->id,
                    'overall_status' => $check->overall_status,
                    'overall_status_label' => $check->overall_status_label,
                    'compliance_score' => $check->compliance_score,
                    'checks' => $check->checks ?? [],
                    'violations_found' => $check->violations_found ?? [],
                    'suggested_caption' => $check->suggested_caption ?? [],
                    'suggested_rejection_reason' => $check->suggested_rejection_reason,
                    'suggested_revision_guidance' => $check->suggested_revision_guidance,
                    'model_used' => $check->model_used,
                    'created_at' => $check->created_at?->toISOString(),
                ];
            }),
            'policy_violations' => $this->whenLoaded('policyViolations', function () {
                return $this->policyViolations->map(function ($violation) {
                    return [
                        'id' => $violation->id,
                        'type' => $violation->violation_type,
                        'type_label' => $violation->type_label,
                        'severity' => $violation->severity,
                        'severity_label' => $violation->severity_label,
                        'severity_color' => $violation->severity_color,
                        'description' => $violation->description,
                        'ai_analysis' => $violation->ai_analysis,
                        'is_resolved' => $violation->is_resolved,
                        'resolved_at' => $violation->resolved_at?->toISOString(),
                        'flagged_by' => $violation->flaggedBy ? [
                            'id' => $violation->flaggedBy->id,
                            'full_name' => $violation->flaggedBy->full_name,
                        ] : null,
                        'created_at' => $violation->created_at?->toISOString(),
                    ];
                });
            }),
            'publishing_records' => $this->whenLoaded('publishingRecords', function () {
                return $this->publishingRecords->map(function ($record) {
                    return [
                        'id' => $record->id,
                        'platform' => $record->platform,
                        'platform_label' => $record->platform_label,
                        'external_post_id' => $record->external_post_id,
                        'external_url' => $record->external_url,
                        'status' => $record->status,
                        'status_label' => $record->status_label,
                        'scheduled_at' => $record->scheduled_at?->toISOString(),
                        'published_at' => $record->published_at?->toISOString(),
                        'error_message' => $record->error_message,
                    ];
                });
            }),
            'current_approval_stage' => $this->current_approval_stage,
            'current_stage_label' => $this->current_stage_label,
            'can_edit' => $this->when(isset($request->user), function () use ($request) {
                return $this->canBeEditedBy($request->user());
            }),
            'can_approve' => $this->when(isset($request->user), function () use ($request) {
                return $this->canBeApprovedBy($request->user());
            }),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}