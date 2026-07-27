<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

echo "Clearing request data...\n";

Schema::disableForeignKeyConstraints();

DB::table('post_media')->truncate();
DB::table('approval_workflows')->truncate();
DB::table('publishing_records')->truncate();
DB::table('ai_compliance_checks')->truncate();
DB::table('policy_violations')->truncate();
DB::table('notifications')->truncate();
DB::table('post_requests')->truncate();

Schema::enableForeignKeyConstraints();

echo "Done.\n";
