<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\PostRequest;

$role = 'office_head';

$query = PostRequest::query();

if ($role === 'office_head') {
    $query->whereNotIn('status', ['draft']);
}

$stats = [
    'rejected' => (clone $query)->where('status', PostRequest::STATUS_REJECTED)->count(),
    'approved' => (clone $query)->where('status', PostRequest::STATUS_APPROVED)->count(),
];

print_r($stats);
