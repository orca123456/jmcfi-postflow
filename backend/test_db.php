<?php
try {
    $dsn = "pgsql:host=aws-1-ap-northeast-2.pooler.supabase.com;port=5432;dbname=postgres;sslmode=require";
    $pdo = new PDO($dsn, "postgres.avkzfxlqovkxygbgifqq", "Nycopaderayon@03");
    echo "Connected successfully to pooler!\n";
} catch (PDOException $e) {
    echo "Connection failed: " . $e->getMessage() . "\n";
}

try {
    $dsn2 = "pgsql:host=db.avkzfxlqovkxygbgifqq.supabase.co;port=5432;dbname=postgres;sslmode=require";
    $pdo2 = new PDO($dsn2, "postgres", "Nycopaderayon03");
    echo "Connected successfully to direct!\n";
} catch (PDOException $e) {
    echo "Connection failed direct: " . $e->getMessage() . "\n";
}
