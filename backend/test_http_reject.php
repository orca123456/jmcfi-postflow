<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::role('office_head')->first();
$token = $user->createToken('test')->plainTextToken;

$client = new \GuzzleHttp\Client();
try {
    $response = $client->post('http://localhost:8000/api/posts/26/reject', [
        'headers' => [
            'Authorization' => "Bearer $token",
            'Accept' => 'application/json',
        ],
        'json' => [
            'reason' => 'REJECT TEST'
        ]
    ]);
    
    echo "Status: " . $response->getStatusCode() . "\n";
    echo "Body: " . $response->getBody() . "\n";
} catch (\GuzzleHttp\Exception\ClientException $e) {
    echo "Client Error: " . $e->getResponse()->getStatusCode() . "\n";
    echo "Response: " . $e->getResponse()->getBody() . "\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
