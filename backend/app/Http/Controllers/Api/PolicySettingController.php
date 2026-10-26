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
        if ($request->user() && $request->user()->roleCategory() !== 'admin') {
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
                'content' => 'This policy establishes definitive publishing, visual branding, and editorial standards for all content displayed on the official Jose Maria College Foundation, Inc. (JMCFI) digital portals (jmc.edu.ph, subdomains, and official institutional social media channels). It applies to all faculty, administrative staff, academic departments, student organizations, and authorized contributors ("Posters"). The primary objective is to safeguard institutional reputation, ensure strict compliance with brand identity, uphold student privacy rights, and deliver accurate, cohesive, and professional public communications.',
            ],
            [
                'id' => 'sec-2',
                'title' => '2. Scope & Brand Guidelines',
                'icon' => 'shield-checkmark-outline',
                'bg' => '#F3E8FF',
                'color' => '#7C3AED',
                'bullets' => [
                    [
                        'title' => 'Official Brand Color Palette',
                        'desc' => "Official digital and print layouts must strictly utilize the approved institutional color hierarchy:\n• <b>Indigo</b> (#4B0082 / #312E81): Primary institutional authority color for formal headings, banners, seals, and primary buttons.\n• <b>Grape</b> (#6F2DA8 / #7E22CE): Secondary vibrant tone for section headers, badges, highlights, and callout borders.\n• <b>Wisteria</b> (#C9A0DC / #DDD6FE): Accent pastel tone for card backgrounds, pill tags, and subtle dividers.\nClashing fluorescent tones, off-brand neon hues, and arbitrary color fills are strictly prohibited.",
                    ],
                    [
                        'title' => 'Logo & Institutional Seal',
                        'desc' => 'The official JMCFI circular seal must be displayed with its original aspect ratio (never stretched, skewed, or rotated). Maintain a clear buffer space of at least 24px around the seal. Use approved transparent PNG or SVG assets. The seal must never be recolored, obscured, or placed over busy photo backgrounds without a solid or semi-transparent backing.',
                    ],
                    [
                        'title' => 'Typography & Readability',
                        'desc' => 'All publication graphics and layouts must use approved institutional typography: clean sans-serif (Inter, Roboto, or Arial) for captions, body copy, and subtitles (minimum 12pt for digital readability); formal serif or bold weights for headlines. Ensure a minimum 4.5:1 WCAG AA contrast ratio against all background colors.',
                    ],
                    [
                        'title' => 'Platform Scope & Editorial Control',
                        'desc' => 'Applies across the central portal (jmc.edu.ph), subdomains, and official institutional social media feeds (Facebook, Instagram, YouTube, LinkedIn). JMCFI Institutional Marketing & Communications (IMC) and IT Administration reserve the right to review, edit, reject, or unpublish any submission without prior notice.',
                    ],
                    [
                        'title' => 'Brand Compliance & Penalties',
                        'desc' => 'Content that deviates from approved colors, distorts official emblems, or violates visual hierarchy will be immediately rejected at the QA stage. Continued submission of non-compliant graphics will result in the suspension of posting privileges.',
                    ],
                ],
            ],
            [
                'id' => 'sec-3',
                'title' => '3. Acceptable Content & Visual Standards',
                'icon' => 'checkmark-circle-outline',
                'bg' => '#DCFCE7',
                'color' => '#16A34A',
                'bullets' => [
                    [
                        'title' => 'Academic & Professional Merit',
                        'desc' => "Content must directly support the school's educational mission, highlight verified student and faculty achievements, or disseminate official institutional announcements. The tone must remain respectful, factual, grammatically correct, and inclusive.",
                    ],
                    [
                        'title' => 'High-Definition Media Standards',
                        'desc' => 'Use high-resolution original media: minimum 1080×1080px for square social posts, 1920×1080px for landscape banners, and vector/300 DPI for printable PDF documents. Blurry photos, low-resolution screenshots, watermarked stock imagery, and heavily compressed graphics are strictly prohibited.',
                    ],
                    [
                        'title' => 'Consent for Minors (Under 18)',
                        'desc' => 'Any photograph, video footage, or identifiable academic work featuring students under 18 years of age requires a valid, signed Parental/Guardian Media Consent Waiver on file prior to submission.',
                    ],
                    [
                        'title' => 'Consent for Adults (18+ & Staff)',
                        'desc' => 'Students aged 18+ and institutional personnel featured as focal subjects in promotional or public campaigns must provide explicit written or signed media release authorization.',
                    ],
                ],
            ],
            [
                'id' => 'sec-4',
                'title' => '4. Prohibited Content',
                'icon' => 'alert-circle-outline',
                'bg' => '#FEE2E2',
                'color' => '#DC2626',
                'bullets' => [
                    [
                        'title' => 'Academic Misconduct & Cheating',
                        'desc' => 'Publishing examination questionnaires, answer keys, test bank excerpts, unauthorized review manuals, or plagiarized academic material is strictly forbidden.',
                    ],
                    [
                        'title' => 'Inappropriate Material & Harassment',
                        'desc' => 'Zero tolerance for cyberbullying, hate speech, vulgarity, defamatory statements, sexually suggestive imagery, partisan politics, or religiously/racially offensive commentary.',
                    ],
                    [
                        'title' => 'Commercial & Political Solicitation',
                        'desc' => 'Unauthorized commercial advertising, personal fundraising, third-party product endorsements, paid sponsorships, or political campaigning are strictly prohibited.',
                    ],
                    [
                        'title' => 'Data Privacy & Security Breaches',
                        'desc' => 'Strict adherence to the Data Privacy Act of 2012. Never publish student grades, ID numbers, home addresses, phone numbers, personal email addresses, or confidential administrative records.',
                    ],
                ],
            ],
            [
                'id' => 'sec-5',
                'title' => '5. Copyright & Intellectual Property',
                'icon' => 'copy-outline',
                'bg' => '#FEF3C7',
                'color' => '#D97706',
                'content' => 'JMCFI respects intellectual property rights under Republic Act No. 8293. Every contributor is legally responsible for verifying licensing rights, ownership, and proper attribution for all textual, visual, and audio assets.',
                'bullets' => [
                    [
                        'title' => 'Ownership & Licensing Rights',
                        'desc' => 'Posters must own the full copyright or possess explicit written licensing permission for all uploaded photography, graphic illustrations, and audio tracks.',
                    ],
                    [
                        'title' => 'Student & Faculty Research/Works',
                        'desc' => 'Showcasing student capstone projects, artworks, photography, or academic research requires formal written consent and prominent creator attribution.',
                    ],
                    [
                        'title' => 'Approved Media & Asset Libraries',
                        'desc' => 'All media assets must be sourced from the official JMCFI Asset Library, verified royalty-free repositories, or properly attributed Creative Commons sources.',
                    ],
                ],
            ],
            [
                'id' => 'sec-6',
                'title' => '6. Posting Process Flow',
                'icon' => 'git-network-outline',
                'bg' => '#EFF6FF',
                'color' => '#2563EB',
                'steps' => [
                    [
                        'title' => '1. Content Creation & AI Check',
                        'desc' => "Requestor creates the post request (Title, Caption, High-res Media) and utilizes 'AI Check Policy Alignment' to verify brand compliance.",
                    ],
                    [
                        'title' => '2. Department Head Review',
                        'desc' => 'The Department Head reviews the submission for factual accuracy, departmental relevance, and educational standards.',
                    ],
                    [
                        'title' => '3. VP / Executive Sign-Off',
                        'desc' => 'The Vice President evaluates strategic institutional alignment and overarching public relations impact.',
                    ],
                    [
                        'title' => '4. Brand Clearance & IT Publishing',
                        'desc' => 'IMC and IT QA conduct final brand clearance (verifying Indigo, Grape, Wisteria palette & seal integrity) and deploy to the live portal.',
                    ],
                ],
            ],
            [
                'id' => 'sec-7',
                'title' => '7. Enforcement & Contact',
                'icon' => 'warning-outline',
                'bg' => '#F5F5F5',
                'color' => '#4B5563',
                'content' => "Policy violations are handled through a progressive disciplinary structure:\n• First Offense: Immediate content removal with formal written advisory.\n• Second Offense: 30-day suspension of posting rights with mandatory Brand & Policy Retraining.\n• Chronic / Egregious Violations: Permanent revocation of platform privileges and formal referral to the Disciplinary Board or Human Resources.",
                'contact' => 'For brand asset kits, official color specifications, or policy questions, email IMC at imc@jmc.edu.ph or IT Services at it@jmc.edu.ph.',
            ],
        ];
    }
}
