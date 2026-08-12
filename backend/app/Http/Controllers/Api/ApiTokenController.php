<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApiTokenController extends Controller
{
    /**
     * List all tokens for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $tokens = $request->user()->tokens()
            ->where('name', '!=', 'postflow-api')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($token) {
            return [
                'id' => $token->id,
                'name' => $token->name,
                'last_used_at' => $token->last_used_at,
                'created_at' => $token->created_at,
            ];
        });

        return response()->json([
            'data' => $tokens,
            'message' => 'Tokens retrieved successfully.',
        ]);
    }

    /**
     * Generate a new API token.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $token = $request->user()->createToken($request->name);

        return response()->json([
            'data' => [
                'id' => $token->accessToken->id,
                'name' => $token->accessToken->name,
                'plain_text_token' => $token->plainTextToken,
                'created_at' => $token->accessToken->created_at,
            ],
            'message' => 'Token generated successfully.',
        ], 201);
    }

    /**
     * Revoke a specific API token.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        \Log::info("Destroy called for token $id by user " . $request->user()->id);
        $deleted = $request->user()->tokens()->where('id', $id)->delete();
        \Log::info("Deleted count: $deleted");

        return response()->json([
            'message' => 'Token revoked successfully.',
        ]);
    }
}
