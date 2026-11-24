<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\SystemSetting;

return new class extends Migration
{
    public function up(): void
    {
        $cleanRows = json_encode([
            ['label' => 'Title', 'value' => 'Annual Student Orientation 2026'],
            ['label' => 'Category', 'value' => 'Announcement'],
            ['label' => 'Published Platforms', 'value' => 'Facebook, Instagram'],
            ['label' => 'Published At', 'value' => now()->format('M d, Y h:i A')],
            ['label' => 'Facebook Post ID', 'value' => '122125475451447703'],
        ]);

        $setting = SystemSetting::where('key', 'email_template_details_json')->first();
        if ($setting) {
            $val = (string)$setting->value;
            if (str_contains($val, 'AAAA') || str_contains($val, 'aaaa')) {
                $setting->update(['value' => $cleanRows]);
            }
        }
    }

    public function down(): void
    {
    }
};
