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

            // Determine active user identity and role
            $user = $request->user();
            $roleCategory = $user ? $user->roleCategory() : 'requestor';
            $workflowRole = $user ? ($user->workflowRole() ?? $roleCategory) : 'requestor';
            $userName = $user ? ($user->first_name . ' ' . $user->last_name) : 'User';
            $department = $user?->department ?? 'General';

            $roleContext = "\n\n## 12. CURRENT USER SESSION & ROLE-BASED ACCESS CONTROL\n";
            $roleContext .= "- Logged-in User: {$userName}\n";
            $roleContext .= "- Role Category: {$roleCategory}\n";
            $roleContext .= "- Specific Workflow Role: {$workflowRole}\n";
            $roleContext .= "- Department / Office: {$department}\n\n";

            if ($roleCategory === 'admin') {
                $roleContext .= "### ROLE PERMISSIONS: SYSTEM ADMINISTRATOR / IT ADMIN (UNRESTRICTED - NO BOUNDARIES)\n";
                $roleContext .= "- The user currently chatting with you is a verified SYSTEM ADMINISTRATOR / IT ADMIN.\n";
                $roleContext .= "- **SPECIAL PRIVILEGE: NO BOUNDARIES**. This user has complete unrestricted access. They can ask and navigate ANYTHING they want, and you MUST answer fully without declining or restricting.\n";
                $roleContext .= "- You may assist them with:\n";
                $roleContext .= "  * Full system administration, server setup, database relationships, and configurations.\n";
                $roleContext .= "  * Any technical query, coding, scripting, API integrations, and troubleshooting.\n";
                $roleContext .= "  * General questions, creative tasks, analytical explanations, or open-ended inquiries.\n";
                $roleContext .= "  * Institutional workflows, user account management, and multi-platform publishing operations.\n";
                $roleContext .= "- DO NOT refuse or decline questions from this user. Treat them as the authorized administrator with complete freedom to navigate and ask anything.\n";
            } elseif ($roleCategory === 'approver') {
                $roleContext .= "### ROLE PERMISSIONS: INSTITUTIONAL APPROVER\n";
                $roleContext .= "- The user currently chatting with you is an Approver ({$workflowRole}) representing {$department}.\n";
                $roleContext .= "- Tailor your answers specifically to review, compliance, and approval responsibilities:\n";
                $roleContext .= "  * Reviewing post requests, quality assurance, branding checks, and institutional policy compliance.\n";
                $roleContext .= "  * Guiding on how to approve, request revisions with constructive notes, or reject inappropriate content.\n";
                $roleContext .= "  * Clarifying their stage in the multi-tier approval workflow.\n";
                $roleContext .= "- Boundaries: Focus on content review, QA, and workflow policies. Politely redirect them back to institutional workflow topics if they request server/backend modifications.\n";
            } else {
                $roleContext .= "### ROLE PERMISSIONS: CONTENT REQUESTOR\n";
                $roleContext .= "- The user currently chatting with you is a Content Requestor ({$workflowRole}) from {$department}.\n";
                $roleContext .= "- Tailor your answers specifically to content creation and submission:\n";
                $roleContext .= "  * Step-by-step guidance on submitting requests, crafting captions, and choosing target platforms.\n";
                $roleContext .= "  * Understanding revision comments and updating returned submissions.\n";
                $roleContext .= "  * Explaining submission requirements, media specs, and tracking request progress.\n";
                $roleContext .= "- Boundaries: Focus strictly on content submission, request tracking, and institutional publishing guidelines.\n";
            }

            $systemPrompt .= $roleContext;

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
