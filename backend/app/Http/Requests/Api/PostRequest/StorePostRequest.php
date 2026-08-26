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
        $isDraft = $this->boolean('is_draft');

        $rules = [
            'title' => ['required', 'string', 'max:255'],
            'caption_narrative' => ['required', 'string', 'max:5000'],
            'category_id' => $isDraft ? ['nullable', 'integer', 'exists:post_categories,id'] : ['required', 'integer', 'exists:post_categories,id'],
            'other_category_name' => ['nullable', 'string', 'max:255'],
            'department_id' => ['nullable', 'string', 'max:255'],
            'target_platforms' => ['nullable', 'array'],
            'target_platforms.*' => ['string', 'in:facebook,instagram,portal'],
            'preferred_schedule_at' => ['nullable', 'date'],
            'is_draft' => ['boolean'],
        ];

        // Media validation when files are uploaded
        if ($this->hasFile('media')) {
            $rules['media'] = ['array'];
            $rules['media.*'] = ['file', 'mimes:jpg,jpeg,png,gif,webp,mp4,mov,avi,pdf,doc,docx', 'max:51200'];
        }

        if ($this->hasFile('supporting_docs')) {
            $rules['supporting_docs'] = ['array'];
            $rules['supporting_docs.*'] = ['file', 'mimes:pdf,doc,docx,xls,xlsx,txt', 'max:51200'];
        }

        return $rules;
    }

    public function messages(): array
    {
        return [
            'title.required' => 'A post title is required.',
            'caption_narrative.required' => 'Please provide a caption for your post.',
            'media.*.max' => 'Each file must not exceed 50MB.',
            'media.*.mimes' => 'Media files must be images (jpg, png, jpeg, gif, webp), videos (mp4, mov, avi), or documents (pdf, doc, docx).',
            'supporting_docs.*.mimes' => 'Supporting documents must be PDF, Word, Excel, or text files.',
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
            $mediaFiles = is_array($mediaFiles) ? $mediaFiles : [$mediaFiles];

            foreach (array_filter($mediaFiles) as $file) {
                if (str_starts_with((string) $file->getMimeType(), 'image/')) {
                    return;
                }
            }

            $validator->errors()->add(
                'media',
                'Instagram publishing requires a photo. Please upload an image before submitting this request.'
            );
        });
    }
}
