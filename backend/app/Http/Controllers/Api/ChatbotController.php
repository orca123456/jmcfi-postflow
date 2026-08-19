<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ChatbotController extends Controller
{
    private string $apiKey;
    private string $apiUrl;
    private string $model;

    public function __construct()
    {
        $this->apiKey = env('DEEPSEEK_API_KEY', '');
        $this->apiUrl = env('DEEPSEEK_API_URL', 'https://api.deepseek.com/v1');
        $this->model = env('DEEPSEEK_MODEL', 'deepseek-chat');
    }

    public function handleMessage(Request $request): JsonResponse
    {
        $request->validate([
            'messages' => 'required|array',
            'messages.*.role' => 'required|string|in:user,assistant',
            'messages.*.content' => 'required|string'
        ]);

        try {
            // Read the markdown prompt from the root folder
            $promptPath = base_path('../chatbot_system_prompt.md');
            $systemPrompt = file_exists($promptPath) 
                ? file_get_contents($promptPath) 
                : 'You are a helpful assistant for JMCFI PostFlow.';

            // Construct payload
            $apiMessages = [
                [
                    'role' => 'system',
                    'content' => $systemPrompt,
                ]
            ];

            // Map incoming messages to deepseek format
            foreach ($request->messages as $msg) {
                $apiMessages[] = [
                    'role' => $msg['role'],
                    'content' => $msg['content']
                ];
            }

            $response = Http::withoutVerifying()->withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(120)->post("{$this->apiUrl}/chat/completions", [
                'model' => $this->model,
                'messages' => $apiMessages,
                'temperature' => 0.7,
                'max_tokens' => 1024,
                'top_p' => 0.9,
            ]);

            if (!$response->successful()) {
                Log::error('Chatbot API Error', [
                    'status' => $response->status(),
                    'body' => $response->body()
                ]);
                return response()->json([
                    'error' => 'Chatbot service unavailable.'
                ], 503);
            }

            $data = $response->json();
            $reply = $data['choices'][0]['message']['content'] ?? 'I could not process that request.';

            return response()->json([
                'reply' => $reply
            ]);

        } catch (\Exception $e) {
            Log::error('Chatbot Controller Exception: ' . $e->getMessage());
            return response()->json([
                'error' => 'An internal error occurred.'
            ], 500);
        }
    }
}
