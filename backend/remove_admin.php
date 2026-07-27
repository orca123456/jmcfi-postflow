<?php
$dsn = "pgsql:host=aws-1-ap-northeast-2.pooler.supabase.com;port=5432;dbname=postgres";
$user = "postgres.avkzfxlqovkxygbgifqq";
$password = "Nycopaderayon@03";

try {
    $pdo = new PDO($dsn, $user, $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    echo "Connected to Supabase successfully!\n";

    // 1. Get role IDs
    $stmt = $pdo->query("SELECT id, name FROM roles WHERE name IN ('admin', 'it_publisher')");
    $roles = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $adminRoleId = null;
    $itPublisherRoleId = null;
    foreach ($roles as $role) {
        if ($role['name'] === 'admin') $adminRoleId = $role['id'];
        if ($role['name'] === 'it_publisher') $itPublisherRoleId = $role['id'];
    }

    echo "Admin Role ID: $adminRoleId, IT Publisher Role ID: $itPublisherRoleId\n";

    if ($adminRoleId && $itPublisherRoleId) {
        // 2. Transfer users from admin to it_publisher
        $stmt = $pdo->prepare("UPDATE model_has_roles SET role_id = :new_id WHERE role_id = :old_id");
        $stmt->execute(['new_id' => $itPublisherRoleId, 'old_id' => $adminRoleId]);
        echo "Transferred users to it_publisher.\n";

        // 3. Delete admin role
        $stmt = $pdo->prepare("DELETE FROM roles WHERE id = :id");
        $stmt->execute(['id' => $adminRoleId]);
        echo "Deleted admin role.\n";
    }

} catch (PDOException $e) {
    echo "Connection failed: " . $e->getMessage() . "\n";
}
