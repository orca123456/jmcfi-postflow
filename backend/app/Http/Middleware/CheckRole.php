<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ensure the authenticated user has at least one of the given roles.
 * Usage: ->middleware('role:it_publisher,it_admin')
 */
class CheckRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            abort(401, 'Unauthenticated');
        }

        if (!$user->hasAnyRole($roles)) {
            abort(403, 'You do not have permission to perform this action.');
        }

        return $next($request);
    }
}
