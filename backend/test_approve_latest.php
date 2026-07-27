<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::role('office_head')->first();
$post = App\Models\PostRequest::latest()->first();

echo "Approving post {$post->id} as user {$user->id}...\n";
echo "Current Stage: " . $post->currentApprovalStage()?->stage . "\n";
echo "Can be approved by OH? " . ($post->canBeApprovedBy($user) ? 'Yes' : 'No') . "\n";

try {
    $request = Illuminate\Http\Request::create('/api/posts/' . $post->id . '/approve', 'POST', ['remarks' => 'Looks good']);
    $request->setUserResolver(function() use ($user) { return $user; });
    
    $controller = app(App\Http\Controllers\Api\PostRequestController::class);
    $response = $controller->approve($request, $post);
    
    echo "Status Code: " . $response->getStatusCode() . "\n";
    echo "Response: " . $response->getContent() . "\n";
} catch (\Exception $e) {
    echo "Exception: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString();
}
