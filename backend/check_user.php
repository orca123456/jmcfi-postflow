<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::first();
if ($user) {
    echo "Found user: " . $user->email . "\n";
    echo "Password verify for 'password123': " . (password_verify('password123', $user->password) ? 'YES' : 'NO') . "\n";
} else {
    echo "No users found in database!\n";
}
