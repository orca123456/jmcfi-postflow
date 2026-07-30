<?php 
require __DIR__.'/vendor/autoload.php'; 
$app = require_once __DIR__.'/bootstrap/app.php'; 
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class); 
$kernel->bootstrap(); 
try { 
    $result = \Illuminate\Support\Facades\Storage::disk('s3')->put('test.txt', 'Hello S3'); 
    var_dump($result); 
} catch (\Exception $e) { 
    echo $e->getMessage(); 
}
