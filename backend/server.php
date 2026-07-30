<?php
// PHP dev server router — proper CORS + routes everything through Laravel
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// Allowed origins — keep in sync with config/cors.php
$allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8081',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8081',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

// Detect API/Sanctum routes — Laravel's HandleCors middleware covers these
$isApiRoute = str_starts_with($uri, '/api') || str_starts_with($uri, '/sanctum');

if ($isApiRoute) {
    // For API routes: let Laravel handle everything including CORS and OPTIONS preflight.
    // Do NOT exit early here — pass through to public/index.php below.
} else {
    // For non-API routes (static files, storage): apply CORS headers here.
    if (in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
    } elseif (!empty($origin)) {
        header('Access-Control-Allow-Origin: *');
    }

    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept, X-Requested-With, X-XSRF-TOKEN');
    header('Access-Control-Max-Age: 86400');

    // Only exit early for OPTIONS on non-API routes (static file preflights)
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// Route everything to Laravel (handles routing, CORS middleware, and file serving)
if ($uri !== '/' && file_exists(__DIR__ . '/public' . $uri)) {
    return false;
}

require_once __DIR__ . '/public/index.php';
