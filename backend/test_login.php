<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::where('email', 'admin@jmc.edu.ph')->first();
if ($user) {
    echo "User exists.\n";
    if (Illuminate\Support\Facades\Hash::check('password123', $user->password)) {
        echo "Password matches.\n";
    } else {
        echo "Password DOES NOT match.\n";
    }
} else {
    echo "User DOES NOT exist.\n";
}
