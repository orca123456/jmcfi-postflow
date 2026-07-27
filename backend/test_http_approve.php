<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::find(27); // Office Head
$token = $user->createToken('test')->plainTextToken;
echo "Token: $token\n";

$client = new \GuzzleHttp\Client();
try {
    $response = $client->post('http://localhost:8000/api/posts/22/approve', [
        'headers' => [
            'Authorization' => "Bearer $token",
            'Accept' => 'application/json',
        ],
        'json' => [
            'remarks' => 'HTTP test'
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
