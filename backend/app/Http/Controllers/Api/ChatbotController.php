<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\AIClient;
use Illuminate\Support\Facades\Log;

class ChatbotController extends Controller
{
    public function __construct(private AIClient $client) {}

    public function handleMessage(Request $request): JsonResponse
    {
        $request->validate([
            'messages' => 'required|array',
            'messages.*.role' => 'required|string|in:user,assistant',
            'messages.*.content' => 'required|string'
        ]);

        try {
            // Read the markdown prompt from root or backend folder
            $possiblePaths = [
                base_path('chatbot_system_prompt.md'),
                base_path('../chatbot_system_prompt.md'),
                base_path('../../chatbot_system_prompt.md'),
            ];

            $systemPrompt = 'You are a helpful assistant for JMCFI PostFlow.';
            foreach ($possiblePaths as $path) {
                if (file_exists($path)) {
                    $systemPrompt = file_get_contents($path);
                    break;
                }
            }

            // Construct payload with injected system prompt
            $apiMessages = [
                [
                    'role' => 'system',
                    'content' => $systemPrompt,
                ]
            ];

            // Keep the server's system instructions separate from user messages.
            foreach ($request->messages as $msg) {
                $apiMessages[] = [
                    'role' => $msg['role'],
                    'content' => $msg['content']
                ];
            }

            $response = $this->client->complete($apiMessages);
            $reply = $response['content'];

            return response()->json([
                'reply' => $reply
            ]);

        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 503);
        } catch (\Exception $e) {
            Log::error('Chatbot Controller Exception: ' . $e->getMessage());
            return response()->json([
                'error' => 'An internal error occurred.'
            ], 500);
        }
    }
}
