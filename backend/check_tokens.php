<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\SystemSetting;

$pageId = SystemSetting::where('key', 'facebook_page_id')->value('value');
$token = SystemSetting::where('key', 'facebook_access_token')->value('value');

echo "Page ID: " . $pageId . "\n";
echo "Token: " . substr($token, 0, 15) . "... (length: " . strlen($token) . ")\n";
