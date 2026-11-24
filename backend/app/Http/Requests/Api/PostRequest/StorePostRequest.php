<?php

namespace App\Http\Requests\Api\PostRequest;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StorePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $rules = [
            'title' => ['required', 'string', 'max:255'],
            'caption_narrative' => ['required', 'string', 'max:5000'],
            'category_id' => ['nullable', 'integer'],
            'other_category_name' => ['nullable', 'string', 'max:255'],
            'department_id' => ['nullable', 'string', 'max:255'],
            'program_head_id' => ['nullable', 'integer', 'exists:program_heads,id'],
            'target_platforms' => ['nullable', 'array'],
            'target_platforms.*' => ['string', 'in:facebook,instagram,portal,wordpress,website,wp'],
            'preferred_schedule_at' => ['nullable', 'date'],
            'is_draft' => ['boolean'],
            'routing_type' => ['nullable', 'string', 'in:standard,direct_imc'],
        ];

        if ($this->hasFile('media')) {
            $rules['media'] = ['nullable'];
            $rules['media.*'] = ['nullable', 'file', 'image', 'mimes:jpeg,png,jpg,webp', 'max:25600'];
        }

        if ($this->hasFile('supporting_docs')) {
            $rules['supporting_docs'] = ['nullable'];
            $rules['supporting_docs.*'] = ['nullable', 'file', 'max:32768'];
        }

        return $rules;
    }

    public function messages(): array
    {
        return [
            'title.required' => 'A post title is required.',
            'caption_narrative.required' => 'Please provide a content caption for your post.',
            'media.*.image' => 'Uploaded media must be an image (JPEG, PNG, WebP). Videos are not allowed.',
            'media.*.mimes' => 'Only JPEG, PNG, and WebP images are allowed. Video files are not supported.',
            'media.*.max' => 'Each image file may not exceed 25MB.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($this->boolean('is_draft')) {
                return;
            }

            if (empty(trim((string) $this->input('caption_narrative')))) {
                $validator->errors()->add('caption_narrative', 'Please provide a content caption for your post.');
            }

            $hasMedia = $this->hasFile('media');
            $hasDocs = $this->hasFile('supporting_docs');
            $isDirectImc = $this->input('routing_type') === 'direct_imc';

            if (!$isDirectImc && !$hasMedia && !$hasDocs) {
                $validator->errors()->add('media', 'Please attach at least one photo or media file before submitting.');
            }

            // Check that every selected target platform is configured before allowing submission
            $targetPlatforms = $this->input('target_platforms', []);
            if (is_string($targetPlatforms)) {
                $decoded = json_decode($targetPlatforms, true);
                $targetPlatforms = is_array($decoded) ? $decoded : array_map('trim', explode(',', $targetPlatforms));
            }
            if (is_array($targetPlatforms) && !empty($targetPlatforms)) {
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
                        "Cannot submit request: {$names} has not finished configuration in the system. Please deselect it before submitting."
                    );
                }
            }
        });
    }
}
