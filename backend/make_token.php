<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$token = \App\Models\User::first()->createToken('Test')->plainTextToken;
file_put_contents('token.txt', $token);
