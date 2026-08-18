<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$ryan = \App\Models\User::where('department', 'Institutional Marketing Communication')->first();
if ($ryan) {
    $ryan->syncRoles(['imc_qa_checker']);
    echo "Updated Ryan's role\n";
}

$dr = \App\Models\User::where('department', 'Vice President for Academic Affairs')->first();
if ($dr) {
    $dr->syncRoles(['vice_president']);
    echo "Updated Dr. Bombeo's role\n";
}
