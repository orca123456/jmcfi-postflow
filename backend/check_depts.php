<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$depts = App\Models\Department::select('id','display_name','logo_path')->get();
foreach ($depts as $d) {
    echo $d->id . ': ' . $d->display_name . PHP_EOL;
    echo '  logo_path: ' . ($d->logo_path ?: 'NULL') . PHP_EOL;
    echo '  logo_url: ' . ($d->logo_url ?: 'NULL') . PHP_EOL;
    echo PHP_EOL;
}
