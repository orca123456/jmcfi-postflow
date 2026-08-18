<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

foreach (\App\Models\User::all() as $u) {
    echo $u->id . ' | ' . $u->first_name . ' ' . $u->last_name . ' | ' . $u->department . ' | ' . $u->getRoleNames()->first() . PHP_EOL;
}
