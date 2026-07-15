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
        ];

        foreach ($settings as $setting) {
            SystemSetting::updateOrCreate(
                ['key' => $setting['key']],
                $setting
            );
        }
    }
}