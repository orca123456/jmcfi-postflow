<?php

namespace App\Http\Requests\Api\PostRequest;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
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
            'target_platforms' => ['nullable', 'array'],
            'target_platforms.*' => ['string', 'in:facebook,instagram,portal,wordpress,website,wp'],
            'preferred_schedule_at' => ['nullable', 'date'],
            'is_draft' => ['boolean'],
        ];

        if ($this->hasFile('media')) {
            $rules['media'] = ['nullable'];
        }

        if ($this->hasFile('supporting_docs')) {
            $rules['supporting_docs'] = ['nullable'];
        }

        return $rules;
    }

    public function messages(): array
    {
        return [
            'title.required' => 'A post title is required.',
            'caption_narrative.required' => 'Please provide a caption for your post.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($this->boolean('is_draft')) {
                return;
            }

            $platforms = $this->input('target_platforms', []);
            if (!is_array($platforms) || !in_array('instagram', $platforms, true)) {
                return;
            }

            $mediaFiles = $this->file('media', []);
            if (!$mediaFiles) {
                $mediaFiles = [];
            }
            $mediaFiles = is_array($mediaFiles) ? $mediaFiles : [$mediaFiles];

            foreach (array_filter($mediaFiles) as $file) {
                if ($file instanceof \Illuminate\Http\UploadedFile) {
                    $mime = strtolower((string) $file->getMimeType());
                    $ext = strtolower((string) $file->getClientOriginalExtension());
                    if (str_starts_with($mime, 'image/') || in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)) {
                        return;
                    }
                }
            }

            $validator->errors()->add(
                'media',
                'Instagram publishing requires a photo. Please upload an image before submitting this request.'
            );
        });
    }
}
