<?php
require 'vendor/autoload.php';
\ = require_once 'bootstrap/app.php';
\ = \->make(Illuminate\Contracts\Http\Kernel::class);
\ = Illuminate\Http\Request::create('/api/login', 'POST', ['email' => 'admin@jmc.edu.ph', 'password' => 'password123']);
\ = \->handle(\);
\ = json_decode(\->getContent(), true)['token'] ?? '';
if (!\) die('Login failed');

\ = microtime(true);
\ = Illuminate\Http\Request::create('/api/dashboard/init', 'GET');
\->headers->set('Authorization', 'Bearer ' . \);
\ = \->handle(\);
\ = microtime(true);
echo 'Time taken: ' . round(\ - \, 2) . ' seconds\n';

