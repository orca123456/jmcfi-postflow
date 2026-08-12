<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = \App\Models\User::where('email', 'admin@jmc.edu.ph')->first();
$tokens = $user->tokens()->where('name', '!=', 'postflow-api')->get();

echo "Found " . $tokens->count() . " tokens.\n";
foreach ($tokens as $t) {
    echo "ID: " . $t->id . " Name: " . $t->name . "\n";
}

if ($tokens->count() > 0) {
    $firstTokenId = $tokens->first()->id;
    echo "Deleting token ID: $firstTokenId\n";
    $deletedCount = $user->tokens()->where('id', $firstTokenId)->delete();
    echo "Deleted count: $deletedCount\n";
}
