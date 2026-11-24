<?php

namespace App\Http\Requests\Api\PostRequest;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdatePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'caption_narrative' => ['sometimes', 'string', 'max:5000'],
            'category_id' => ['nullable', 'integer'],
            'other_category_name' => ['nullable', 'string', 'max:255'],
            'department_id' => ['nullable', 'string', 'max:255'],
            'program_head_id' => ['nullable', 'integer', 'exists:program_heads,id'],
            'target_platforms' => ['nullable', 'array'],
            'target_platforms.*' => ['string'],
            'preferred_schedule_at' => ['nullable', 'date'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $post = $this->route('postRequest');
            $isDraft = $post && $post->status === 'draft';
            if ($isDraft) {
                return;
            }

            if ($this->has('target_platforms')) {
                $targetPlatforms = $this->input('target_platforms', []);
                if (is_string($targetPlatforms)) {
                    $decoded = json_decode($targetPlatforms, true);
                    $targetPlatforms = is_array($decoded) ? $decoded : array_map('trim', explode(',', $targetPlatforms));
                }
                if (is_array($targetPlatforms)) {
                    $unconfigured = [];
                    foreach ($targetPlatforms as $platform) {
                        if (!empty($platform) && !\App\Models\SystemSetting::isPlatformConfigured($platform)) {
                            $unconfigured[] = match (strtolower(trim($platform))) {
                                'facebook' => 'Facebook',
                                'instagram' => 'Instagram',
                                'wordpress', 'website', 'portal', 'wp' => 'Website',
                                default => ucfirst($platform),
                            };
                        }
                    }
                    if (!empty($unconfigured)) {
                        $names = implode(', ', array_unique($unconfigured));
                        $validator->errors()->add(
                            'target_platforms',
                            "Cannot update request: {$names} has not finished configuration in the system. Please deselect it before proceeding."
                        );
                    }
                }
            }
        });
    }
}
