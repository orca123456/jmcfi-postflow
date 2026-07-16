<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\SystemSetting;

class SystemSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            [
                'key' => 'app_name',
                'value' => 'JMCFI PostFlow',
                'type' => 'string',
                'description' => 'Application name',
                'is_public' => true,
            ],
            [
                'key' => 'max_file_size',
                'value' => '10485760',
                'type' => 'integer',
                'description' => 'Maximum file upload size in bytes (10MB)',
                'is_public' => true,
            ],
            [
                'key' => 'allowed_file_types',
                'value' => '["image/jpeg","image/png","image/gif","image/webp","video/mp4","video/webm","video/quicktime","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]',
                'type' => 'json',
                'description' => 'Allowed MIME types for file uploads',
                'is_public' => true,
            ],
            [
                'key' => 'approval_stages',
                'value' => '["office_head","vice_president","president","imc_qa"]',
                'type' => 'json',
                'description' => 'Default approval workflow stages',
                'is_public' => true,
            ],
            [
                'key' => 'ai_model',
                'value' => 'nvidia/nemotron-3-ultra-550b-a55b',
                'type' => 'string',
                'description' => 'NVIDIA AI model for content compliance checking',
                'is_public' => false,
            ],
            [
                'key' => 'policy_effective_date',
                'value' => 'Jun 26, 2026',
                'type' => 'string',
                'description' => 'Policy Effective Date',
                'is_public' => true,
            ],
            [
                'key' => 'policy_last_updated',
                'value' => 'July 15, 2026',
                'type' => 'string',
                'description' => 'Policy Last Updated Date',
                'is_public' => true,
            ],
            [
                'key' => 'policy_sections',
                'value' => '[{"id":"sec-1","title":"1. Purpose","icon":"book-outline","bg":"#EFF6FF","color":"#0B2545","content":"This policy governs all content published on the official Jose Maria College Foundation, Inc. website (jcm.edu.ph). It applies to all faculty, staff, students, and authorized contributors (\"Posters\"). The goal is to ensure a cohesive, safe, and professionally branded digital presence."},{"id":"sec-2","title":"2. Scope & Limitations","icon":"shield-checkmark-outline","bg":"#F3E8FF","color":"#7C3AED","bullets":[{"title":"Brand Integrity","desc":"All content must adhere to the official JMCFI Brand Guidelines (colors, logos, typography)."},{"title":"Platform Limitation","desc":"This policy applies exclusively to the official school domain and subdomains."},{"title":"Editorial Control","desc":"The school reserves the right to edit, reject, or remove any content without prior notice."},{"title":"Non-Compliance","desc":"Violation results in immediate removal from the platform and potential disciplinary action."}]},{"id":"sec-3","title":"3. Acceptable Content","icon":"checkmark-circle-outline","bg":"#DCFCE7","color":"#16A34A","bullets":[{"title":"Academic & Professional","desc":"Content must support the school\'s mission, be factually accurate, and maintain an inclusive tone."},{"title":"Visual Standards","desc":"Use approved templates, high-resolution media, and official school colors/logo only."},{"title":"Consent (Minors Under 18)","desc":"Written parental/guardian consent is required."},{"title":"Consent (Adults 18+)","desc":"Student\'s own signed consent is required."}]},{"id":"sec-4","title":"4. Prohibited Content","icon":"alert-circle-outline","bg":"#FEE2E2","color":"#DC2626","bullets":[{"title":"Academic Misconduct","desc":"Cheating guides, answer keys, or plagiarism."},{"title":"Inappropriate Material","desc":"Bullying, hate speech, explicit content, or harassment."},{"title":"Commercial/Political","desc":"Unauthorized ads, personal fundraising, or political endorsements."},{"title":"Privacy Breach","desc":"Publishing student grades, private addresses, or administrative records."}]},{"id":"sec-5","title":"5. Copyright & Intellectual Property","icon":"copy-outline","bg":"#FEF3C7","color":"#D97706","bullets":[{"title":"Ownership rights","desc":"Posters must own the rights to content or have written permission."},{"title":"Student Work","desc":"Showcasing student work requires proper consent (see Section 3)."},{"title":"Approved Media","desc":"Images/music must be sourced from the school\'s asset library or royalty-free databases."}]},{"id":"sec-6","title":"6. Posting Process Flow","icon":"git-network-outline","bg":"#EFF6FF","color":"#2563EB","steps":[{"title":"Content Creation","desc":"Poster submits request (Title, Caption, Media)."},{"title":"Quality Check","desc":"Verification of brand guidelines and factual accuracy."},{"title":"Approval","desc":"Multi-level sign-off (Dept Head, VP, President if required)."},{"title":"Publishing","desc":"Final deployment by the IT Department."}]},{"id":"sec-7","title":"7. Enforcement & Contact","icon":"warning-outline","bg":"#F5F5F5","color":"#4B5563","content":"First Offense: Content removal and formal warning.\nRepeated Violations: Permanent revocation of posting privileges.\nSerious Breaches: Referral to the Disciplinary Board or HR.","contact":"For questions, email communication@jmc.edu.ph or it@jmc.edu.ph."}]',
                'type' => 'json',
                'description' => 'Policy sections list and rules details',
                'is_public' => true,
            ],
        ];

        foreach ($settings as $setting) {
            SystemSetting::updateOrCreate(
                ['key' => $setting['key']],
                $setting
            );
        }
    }
}