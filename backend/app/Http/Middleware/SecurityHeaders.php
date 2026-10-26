<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Adds security-related HTTP headers to every response:
 * - X-Frame-Options          : blocks clickjacking
 * - X-Content-Type-Options   : blocks MIME-type sniffing
 * - Referrer-Policy          : limits referrer leakage
 * - Strict-Transport-Security: forces HTTPS in production (HSTS)
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Content-Security-Policy (requires 'unsafe-eval' for frontend bundle runtime execution)
        $csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-ancestors 'self'; object-src 'none'; base-uri 'self';";
        $response->headers->set('Content-Security-Policy', $csp);

        $isHttps = app()->environment('production') || str_starts_with((string) config('app.url'), 'https') || $request->isSecure();

        if ($isHttps) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

            foreach ($response->headers->getCookies() as $cookie) {
                $newCookie = $cookie;
                if (!$newCookie->isSecure()) {
                    $newCookie = $newCookie->withSecure(true);
                }
                if ($newCookie->getName() === 'XSRF-TOKEN' && !$newCookie->isHttpOnly()) {
                    $newCookie = $newCookie->withHttpOnly(true);
                }
                if ($newCookie !== $cookie) {
                    $response->headers->setCookie($newCookie);
                }
            }
        }

        return $response;
    }
}
