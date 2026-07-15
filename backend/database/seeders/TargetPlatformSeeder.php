<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\TargetPlatform;

class TargetPlatformSeeder extends Seeder
{
    public function run(): void
    {
        $platforms = [
            [
                'name' => 'WordPress',
                'slug' => 'wordpress',
                'icon' => 'wordpress',
                'color' => '#0073AA',
                'config_schema' => [
                    'api_url' => 'string',
                    'username' => 'string',
                    'app_password' => 'string',
                ],
                'is_active' => true,
            ],
            [
                'name' => 'Facebook',
                'slug' => 'facebook',
                'icon' => 'facebook',
                'color' => '#1877F2',
                'config_schema' => [
                    'app_id' => 'string',
                    'app_secret' => 'string',
                    'page_id' => 'string',
                    'access_token' => 'string',
                ],
                'is_active' => true,
            ],
            [
                'name' => 'Instagram',
                'slug' => 'instagram',
                'icon' => 'instagram',
                'color' => '#E4405F',
                'config_schema' => [
                    'app_id' => 'string',
                    'app_secret' => 'string',
                    'business_account_id' => 'string',
                    'access_token' => 'string',
                ],
                'is_active' => true,
            ],
        ];

        foreach ($platforms as $platform) {
            TargetPlatform::updateOrCreate(
                ['slug' => $platform['slug']],
                $platform
            );
        }
    }
}