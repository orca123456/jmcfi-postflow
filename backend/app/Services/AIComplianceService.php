<?php

namespace App\Services;

use App\Models\AIComplianceCheck;
use App\Models\PostRequest;
use App\Models\PolicyViolation;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AIComplianceService
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

    public function checkCompliance(PostRequest $postRequest): array
    {
        $startTime = microtime(true);
        
        try {
            $prompt = $this->buildCompliancePrompt($postRequest);
            
            $response = Http::withoutVerifying()->withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(120)->post("{$this->apiUrl}/chat/completions", [
                'model' => $this->model,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => $this->getSystemPrompt(),
                    ],
                    [
                        'role' => 'user',
                        'content' => $prompt,
                    ],
                ],
                'temperature' => 0.3,
                'max_tokens' => 2048,
                'top_p' => 0.9,
            ]);

            if (!$response->successful()) {
                Log::error('AI Compliance API Error', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'post_id' => $postRequest->id,
                ]);
                throw new \Exception('AI service unavailable: ' . $response->status());
            }

            $data = $response->json();
            $content = $data['choices'][0]['message']['content'] ?? '';
            $tokensUsed = $data['usage']['total_tokens'] ?? 0;
            $processingTime = (microtime(true) - $startTime) * 1000;

            $result = $this->parseComplianceResponse($content);
            
            // Map status
            $rawStatus = $result['overall_status'] ?? 'needs_review';
            $statusMap = [
                'compliant' => 'pass',
                'needs_review' => 'review_required',
                'non_compliant' => 'fail',
            ];
            $mappedStatus = $statusMap[$rawStatus] ?? 'review_required';

            // Save the AI check result
            $aiCheck = AIComplianceCheck::updateOrCreate(
                ['post_request_id' => $postRequest->id],
                [
                    'checked_by_user_id' => null, // AI check
                    'check_results' => $result['checks'] ?? [],
                    'violations_found' => [], // Will be updated if there are violations
                    'suggested_rejection_reason' => $result['rejection_reason_suggestion'] ?? null,
                    'suggested_revision_guidance' => $result['revision_guidance'] ?? null,
                    'suggested_improved_caption' => $result['suggested_improved_caption'] ?? null,
                    'overall_status' => $mappedStatus,
                    'confidence_score' => $result['overall_compliance_score'] ?? ($result['compliance_score'] ?? 0),
                    'model_used' => $this->model,
                    'prompt_used' => $prompt,
                ]
            );

            // Update post request with AI results
            $postRequest->update([
                'ai_compliance_result' => $result['checks'] ?? [],
                'ai_suggested_caption' => $result['suggested_caption'] ?? null,
            ]);

            // Create policy violations for failed checks
            $this->createPolicyViolations($postRequest, $result);

            return [
                'ai_check_id' => $aiCheck->id,
                'compliance_score' => $result['compliance_score'] ?? 0,
                'overall_status' => $result['overall_status'] ?? 'needs_review',
                'checks' => $result['checks'] ?? [],
                'suggested_caption' => $result['suggested_caption'] ?? null,
                'analysis_logic' => $result['analysis_logic'] ?? '',
                'policy_alignment' => $result['policy_alignment'] ?? '',
                'tokens_used' => $tokensUsed,
                'processing_time_ms' => round($processingTime),
            ];

        } catch (\Exception $e) {
            Log::error('AI Compliance Check Failed', [
                'error' => $e->getMessage(),
                'post_id' => $postRequest->id,
                'trace' => $e->getTraceAsString(),
            ]);

            // Return fallback result
            return [
                'ai_check_id' => null,
                'compliance_score' => 0,
                'overall_status' => 'error',
                'checks' => [],
                'suggested_caption' => null,
                'analysis_logic' => 'AI service unavailable: ' . $e->getMessage(),
                'policy_alignment' => '',
                'tokens_used' => 0,
                'processing_time_ms' => 0,
            ];
        }
    }

    public function checkDraftCompliance(string $title, string $caption): array
    {
        $startTime = microtime(true);
        
        try {
            $prompt = <<<PROMPT
Analyze this JMCFI post draft for compliance:

POST DETAILS:
- Title: {$title}
- Category: General
- Target Platforms: N/A
- Department: N/A
- Media Attachments: None

CAPTION/NARRATIVE:
{$caption}

Provide compliance analysis as JSON with the exact structure specified in system prompt.
PROMPT;
            
            $response = Http::withoutVerifying()->withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(120)->post("{$this->apiUrl}/chat/completions", [
                'model' => $this->model,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => $this->getSystemPrompt(),
                    ],
                    [
                        'role' => 'user',
                        'content' => $prompt,
                    ],
                ],
                'temperature' => 0.3,
                'max_tokens' => 2048,
                'top_p' => 0.9,
            ]);

            if (!$response->successful()) {
                throw new \Exception('AI service unavailable: ' . $response->status());
            }

            $data = $response->json();
            $content = $data['choices'][0]['message']['content'] ?? '';
            $tokensUsed = $data['usage']['total_tokens'] ?? 0;
            $processingTime = (microtime(true) - $startTime) * 1000;

            $result = $this->parseComplianceResponse($content);
            
            return [
                'compliance_score' => $result['overall_compliance_score'] ?? ($result['compliance_score'] ?? 0),
                'overall_status' => $result['overall_status'] ?? 'needs_review',
                'checks' => $result['checks'] ?? [],
                'suggested_caption' => $result['suggested_caption'] ?? null,
                'analysis_logic' => $result['analysis_logic'] ?? '',
                'policy_alignment' => $result['policy_alignment'] ?? '',
                'tokens_used' => $tokensUsed,
                'processing_time_ms' => round($processingTime),
            ];

        } catch (\Exception $e) {
            return [
                'compliance_score' => 0,
                'overall_status' => 'error',
                'checks' => [],
                'suggested_caption' => null,
                'analysis_logic' => 'AI service unavailable: ' . $e->getMessage(),
                'policy_alignment' => '',
                'tokens_used' => 0,
                'processing_time_ms' => 0,
            ];
        }
    }

    private function getSystemPrompt(): string
    {
        $policyRulesText = "";
        try {
            $sectionsJson = \App\Models\SystemSetting::where('key', 'policy_sections')->value('value');
            $sections = $sectionsJson ? json_decode($sectionsJson, true) : null;
            
            if (!$sections || !is_array($sections)) {
                $sections = [
                    [
                        'title' => '1. Purpose',
                        'content' => 'This policy governs all content published on the official Jose Maria College Foundation, Inc. website (jcm.edu.ph). It applies to all faculty, staff, students, and authorized contributors ("Posters"). The goal is to ensure a cohesive, safe, and professionally branded digital presence.',
                    ],
                    [
                        'title' => '2. Scope & Limitations',
                        'bullets' => [
                            ['title' => 'Brand Integrity', 'desc' => 'All content must adhere to the official JMCFI Brand Guidelines (colors, logos, typography).'],
                            ['title' => 'Platform Limitation', 'desc' => 'This policy applies exclusively to the official school domain and subdomains.'],
                            ['title' => 'Editorial Control', 'desc' => 'The school reserves the right to edit, reject, or remove any content without prior notice.'],
                            ['title' => 'Non-Compliance', 'desc' => 'Violation results in immediate removal from the platform and potential disciplinary action.'],
                        ],
                    ],
                    [
                        'title' => '3. Acceptable Content',
                        'bullets' => [
                            ['title' => 'Academic & Professional', 'desc' => 'Content must support the school\'s mission, be factually accurate, and maintain an inclusive tone.'],
                            ['title' => 'Visual Standards', 'desc' => 'Use approved templates, high-resolution media, and official school colors/logo only.'],
                            ['title' => 'Consent (Minors Under 18)', 'desc' => 'Written parental/guardian consent is required.'],
                            ['title' => 'Consent (Adults 18+)', 'desc' => 'Student\'s own signed consent is required.'],
                        ],
                    ],
                    [
                        'title' => '4. Prohibited Content',
                        'bullets' => [
                            ['title' => 'Academic Misconduct', 'desc' => 'Cheating guides, answer keys, or plagiarism.'],
                            ['title' => 'Inappropriate Material', 'desc' => 'Bullying, hate speech, explicit content, or harassment.'],
                            ['title' => 'Commercial/Political', 'desc' => 'Unauthorized ads, personal fundraising, or political endorsements.'],
                            ['title' => 'Privacy Breach', 'desc' => 'Publishing student grades, private addresses, or administrative records.'],
                        ],
                    ],
                ];
            }

            if (is_array($sections)) {
                $policyRulesText = "\n\nOFFICIAL JMCFI SYSTEM POLICIES (Must be strictly followed):\n";
                foreach ($sections as $section) {
                    $policyRulesText .= "- " . ($section['title'] ?? 'Rule') . ":\n";
                    if (!empty($section['content'])) {
                        $policyRulesText .= "  " . $section['content'] . "\n";
                    }
                    if (!empty($section['bullets'])) {
                        foreach ($section['bullets'] as $bullet) {
                            $title = $bullet['title'] ?? '';
                            $desc = $bullet['desc'] ?? '';
                            $policyRulesText .= "  * {$title}: {$desc}\n";
                        }
                    }
                    if (!empty($section['steps'])) {
                        foreach ($section['steps'] as $step) {
                            $title = $step['title'] ?? '';
                            $desc = $step['desc'] ?? '';
                            $policyRulesText .= "  * {$title}: {$desc}\n";
                        }
                    }
                }
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Failed to load dynamic policies for AI', ['error' => $e->getMessage()]);
        }

        return <<<PROMPT
You are an AI Content Compliance Assistant for Jose Maria College Foundation, Inc. (JMCFI).
Your role is to analyze captions, narratives, and content materials for official institutional posts
against the following criteria:

1. ACCURACY & FACTUALITY - Verify factual claims, dates, names, statistics. Flag unverified claims.
2. COMPLETENESS - Check if all required information is present (who, what, when, where, why, how).
3. BRANDING & STYLE - Ensure tone matches institutional voice, proper terminology, and brand guidelines. 
   - Typography Rules: "Old English Text MT" is the official font that represents the JOSE MARIA COLLEGE in all Official Communications. Note: This is only intended for Letter Head but not as to the body text of the letter only. "Montserrat" should be used as the primary Sans Serif font for heavy text. "Book Antiqua" should be used as the primary Serif font for heavy text. Remind users of these fonts if applicable in the caption suggestions.
4. PRIVACY & DATA PROTECTION - Identify PII, student records, sensitive info that shouldn't be public.
5. POSTING COMPLIANCE - Check against JMCFI posting policy: no prohibited content, proper format, platform-appropriate.
{$policyRulesText}

For each criterion, provide:
- passed: true/false
- score: 0-100
- issues: array of specific issues found
- suggestions: array of improvement suggestions

Also provide:
- overall_compliance_score: 0-100 (weighted average)
- overall_status: "compliant" | "needs_review" | "non_compliant"
- suggested_improved_caption: improved version if issues found
- rejection_reason_suggestion: suggested rejection reason if non-compliant
- revision_guidance: specific guidance for revision
- analysis_logic: your reasoning process
- policy_alignment: "aligned" | "partially_aligned" | "not_aligned"

Return ONLY valid JSON.
PROMPT;
    }

    private function buildCompliancePrompt(PostRequest $postRequest): string
    {
        $category = $postRequest->category?->name ?? 'General';
        $platforms = implode(', ', $postRequest->target_platforms ?? []);
        $department = $postRequest->requestor->department ?? 'N/A';
        
        $mediaInfo = $postRequest->media->map(function ($media) {
            return "{$media->type}: {$media->original_name}";
        })->implode('; ');

        $mediaAttachments = $mediaInfo ?: 'None';

        return <<<PROMPT
Analyze this JMCFI post request for compliance:

POST DETAILS:
- Title: {$postRequest->title}
- Category: {$category}
- Target Platforms: {$platforms}
- Department: {$department}
- Media Attachments: {$mediaAttachments}

CAPTION/NARRATIVE:
{$postRequest->caption_narrative}

Provide compliance analysis as JSON with the exact structure specified in system prompt.
PROMPT;
    }

    private function parseComplianceResponse(string $content): array
    {
        // Try to extract JSON from the response
        $jsonMatch = [];
        if (preg_match('/\{.*\}/s', $content, $jsonMatch)) {
            $json = json_decode($jsonMatch[0], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $json;
            }
        }

        // Fallback parsing
        return [
            'compliance_score' => 50,
            'overall_status' => 'needs_review',
            'checks' => [
                'accuracy' => ['passed' => true, 'score' => 75, 'issues' => [], 'suggestions' => []],
                'completeness' => ['passed' => true, 'score' => 75, 'issues' => [], 'suggestions' => []],
                'branding' => ['passed' => true, 'score' => 75, 'issues' => [], 'suggestions' => []],
                'privacy' => ['passed' => true, 'score' => 75, 'issues' => [], 'suggestions' => []],
                'compliance' => ['passed' => true, 'score' => 75, 'issues' => [], 'suggestions' => []],
            ],
            'suggested_caption' => null,
            'rejection_reason_suggestion' => null,
            'revision_guidance' => 'AI analysis could not be completed. Manual review required.',
            'analysis_logic' => 'Fallback parsing used due to JSON extraction failure.',
            'policy_alignment' => 'partially_aligned',
        ];
    }

    private function createPolicyViolations(PostRequest $postRequest, array $result): void
    {
        $checks = $result['checks'] ?? [];
        $severityMap = [
            'accuracy' => 'high',
            'completeness' => 'medium',
            'branding' => 'medium',
            'privacy' => 'critical',
            'compliance' => 'high',
        ];

        foreach ($checks as $category => $check) {
            if (isset($check['passed']) && !$check['passed']) {
                $issues = $check['issues'] ?? [];
                if (!empty($issues)) {
                    PolicyViolation::create([
                        'post_request_id' => $postRequest->id,
                        'user_id' => $postRequest->requestor_id,
                        'flagged_by_user_id' => null, // AI flagged
                        'violation_type' => $category,
                        'severity' => $severityMap[$category] ?? 'medium',
                        'description' => implode('; ', $issues),
                        'ai_generated_reason' => $result['rejection_reason_suggestion'] ?? 
                            "AI detected {$category} issues: " . implode(', ', $issues),
                        'human_reviewed' => false,
                    ]);
                }
            }
        }
    }

    public function generateRejectionReason(PostRequest $postRequest, array $context = []): string
    {
        $aiCheck = $postRequest->aiComplianceCheck;
        
        if ($aiCheck && $aiCheck->suggested_rejection_reason) {
            $baseReason = $aiCheck->suggested_rejection_reason;
        } else {
            $baseReason = 'Content does not meet JMCFI posting standards.';
        }

        $violations = $postRequest->policyViolations()->where('human_reviewed', false)->get();
        if ($violations->isNotEmpty()) {
            $violationTypes = $violations->pluck('violation_type')->unique()->implode(', ');
            $baseReason .= " Issues found: {$violationTypes}.";
        }

        return $baseReason;
    }

    public function generateRevisionGuidance(PostRequest $postRequest): array
    {
        $aiCheck = $postRequest->aiComplianceCheck;
        $guidance = [];

        if ($aiCheck && $aiCheck->checks) {
            foreach ($aiCheck->checks as $category => $check) {
                if (isset($check['passed']) && !$check['passed']) {
                    $guidance[$category] = $check['suggestions'] ?? [];
                }
            }
        }

        $violations = $postRequest->policyViolations()->where('human_reviewed', false)->get();
        foreach ($violations as $violation) {
            $guidance[$violation->violation_type][] = $violation->description;
        }

        return $guidance;
    }
}