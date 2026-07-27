<?php

namespace App\Http\Requests\Api\PostRequest;

use Illuminate\Foundation\Http\FormRequest;

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
            'category_id' => ['nullable', 'integer', 'exists:post_categories,id'],
            'department_id' => ['nullable', 'string', 'max:255'],
            'target_platforms' => ['nullable', 'array'],
            'target_platforms.*' => ['string'],
            'preferred_schedule_at' => ['nullable', 'date'],
        ];
    }
}
