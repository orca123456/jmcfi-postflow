<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Http;

$token = SystemSetting::where('key', 'facebook_access_token')->value('value');

$response = Http::withoutVerifying()->get('https://graph.facebook.com/me', [
    'access_token' => $token
]);

echo "Response from /me:\n";
echo $response->body() . "\n";
