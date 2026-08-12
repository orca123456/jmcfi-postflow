<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
use Illuminate\Support\Facades\DB;
$tokens = DB::table('personal_access_tokens')->get();
foreach ($tokens as $t) {
    echo "ID: $t->id, Name: $t->name\n";
}
