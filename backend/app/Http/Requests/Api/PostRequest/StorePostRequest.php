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
            'caption_narrative.required' => 'Please provide a content caption for your post.',
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

            if (!$hasMedia && !$hasDocs) {
                $validator->errors()->add('media', 'Please attach at least one photo or media file before submitting.');
            }
        });
    }
}
