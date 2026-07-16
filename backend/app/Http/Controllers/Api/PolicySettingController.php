<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PolicySettingController extends Controller
{
    /**
     * Get all policy rules and dates.
     */
    public function getSettings(): JsonResponse
    {
        $effectiveDate = SystemSetting::where('key', 'policy_effective_date')->value('value') ?? 'Jun 26, 2026';
        $lastUpdated = SystemSetting::where('key', 'policy_last_updated')->value('value') ?? 'July 15, 2026';
        
        $sectionsJson = SystemSetting::where('key', 'policy_sections')->value('value');
        $sections = $sectionsJson ? json_decode($sectionsJson, true) : null;

        if (!$sections) {
            $sections = $this->getDefaultSections();
        }

        return response()->json([
            'effective_date' => $effectiveDate,
            'last_updated' => $lastUpdated,
            'sections' => $sections,
        ]);
    }

    /**
     * Update policy rules and dates.
     */
    public function updateSettings(Request $request): JsonResponse
    {
        // Require admin role
        if ($request->user() && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized. Admin role required.'], 403);
        }

        $validated = $request->validate([
            'effective_date' => 'required|string',
            'last_updated' => 'required|string',
            'sections' => 'required|array',
        ]);

        SystemSetting::updateOrCreate(
            ['key' => 'policy_effective_date'],
            [
                'value' => $validated['effective_date'],
                'type' => 'string',
                'description' => 'Policy Effective Date',
                'is_public' => true
            ]
        );

        SystemSetting::updateOrCreate(
            ['key' => 'policy_last_updated'],
            [
                'value' => $validated['last_updated'],
                'type' => 'string',
                'description' => 'Policy Last Updated Date',
                'is_public' => true
            ]
        );

        SystemSetting::updateOrCreate(
            ['key' => 'policy_sections'],
            [
                'value' => json_encode($validated['sections']),
                'type' => 'json',
                'description' => 'Policy Sections and Rules Details',
                'is_public' => true
            ]
        );

        return response()->json([
            'message' => 'Policy rules updated successfully',
            'effective_date' => $validated['effective_date'],
            'last_updated' => $validated['last_updated'],
            'sections' => $validated['sections'],
        ]);
    }

    /**
     * Default policy rules config fallback.
     */
    private function getDefaultSections(): array
    {
        return [
            [
                'id' => 'sec-1',
                'title' => '1. Purpose',
                'icon' => 'book-outline',
                'bg' => '#EFF6FF',
                'color' => '#0B2545',
                'content' => 'This policy governs all content published on the official Jose Maria College Foundation, Inc. website (jcm.edu.ph). It applies to all faculty, staff, students, and authorized contributors ("Posters"). The goal is to ensure a cohesive, safe, and professionally branded digital presence.',
            ],
            [
                'id' => 'sec-2',
                'title' => '2. Scope & Limitations',
                'icon' => 'shield-checkmark-outline',
                'bg' => '#F3E8FF',
                'color' => '#7C3AED',
                'bullets' => [
                    ['title' => 'Brand Integrity', 'desc' => 'All content must adhere to the official JMCFI Brand Guidelines (colors, logos, typography).'],
                    ['title' => 'Platform Limitation', 'desc' => 'This policy applies exclusively to the official school domain and subdomains.'],
                    ['title' => 'Editorial Control', 'desc' => 'The school reserves the right to edit, reject, or remove any content without prior notice.'],
                    ['title' => 'Non-Compliance', 'desc' => 'Violation results in immediate removal from the platform and potential disciplinary action.'],
                ],
            ],
            [
                'id' => 'sec-3',
                'title' => '3. Acceptable Content',
                'icon' => 'checkmark-circle-outline',
                'bg' => '#DCFCE7',
                'color' => '#16A34A',
                'bullets' => [
                    ['title' => 'Academic & Professional', 'desc' => 'Content must support the school\'s mission, be factually accurate, and maintain an inclusive tone.'],
                    ['title' => 'Visual Standards', 'desc' => 'Use approved templates, high-resolution media, and official school colors/logo only.'],
                    ['title' => 'Consent (Minors Under 18)', 'desc' => 'Written parental/guardian consent is required.'],
                    ['title' => 'Consent (Adults 18+)', 'desc' => 'Student\'s own signed consent is required.'],
                ],
            ],
            [
                'id' => 'sec-4',
                'title' => '4. Prohibited Content',
                'icon' => 'alert-circle-outline',
                'bg' => '#FEE2E2',
                'color' => '#DC2626',
                'bullets' => [
                    ['title' => 'Academic Misconduct', 'desc' => 'Cheating guides, answer keys, or plagiarism.'],
                    ['title' => 'Inappropriate Material', 'desc' => 'Bullying, hate speech, explicit content, or harassment.'],
                    ['title' => 'Commercial/Political', 'desc' => 'Unauthorized ads, personal fundraising, or political endorsements.'],
                    ['title' => 'Privacy Breach', 'desc' => 'Publishing student grades, private addresses, or administrative records.'],
                ],
            ],
        ];
    }
}
