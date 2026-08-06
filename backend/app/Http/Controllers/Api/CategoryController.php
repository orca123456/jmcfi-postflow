<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PostCategory;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = PostCategory::where('is_active', true)
            ->select('id', 'name', 'slug', 'icon', 'color')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $categories]);
    }
}
