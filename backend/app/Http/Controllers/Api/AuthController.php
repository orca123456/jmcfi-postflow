<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Auth\LoginRequest;
use App\Http\Requests\Api\Auth\RegisterRequest;
use App\Http\Resources\Api\UserResource;
use App\Models\User;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $throttleKey = $this->loginThrottleKey($request);
        $user = User::where('email', $request->email)->first();

        if (($seconds = $this->loginLockoutSeconds($throttleKey)) > 0) {
            AuditLogService::logForUser($user, 'LOGIN_LOCKED', 'Blocked login attempt during lockout for ' . $request->email, 'WARNING', [
                'email' => $request->email,
                'retry_after' => $seconds,
            ], $request);

            return response()->json([
                'message' => 'Too many login attempts. Please try again in ' . $seconds . ' seconds.',
                'retry_after' => $seconds
            ], 429);
        }

        if (! $user || ! Hash::check($request->password, $user->password)) {
            $retryAfter = $this->recordFailedLogin($throttleKey);
            AuditLogService::logForUser($user, 'LOGIN_FAILED', 'Failed login attempt for ' . $request->email, 'WARNING', [
                'email' => $request->email,
                'locked' => $retryAfter > 0,
            ], $request);
            if ($retryAfter > 0) {
                return response()->json([
                    'message' => 'Too many login attempts. Please try again in ' . $retryAfter . ' seconds.',
                    'retry_after' => $retryAfter,
                ], 429);
            }

            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $this->clearFailedLogins($throttleKey);

        if (! $user->isActive()) {
            AuditLogService::logForUser($user, 'LOGIN_BLOCKED', 'Inactive user attempted to login: ' . $user->email, 'WARNING', [
                'email' => $user->email,
            ], $request);

            return response()->json([
                'message' => 'Your account has been deactivated. Please contact administrator.',
            ], 403);
        }

        $token = $user->createToken('postflow-api')->plainTextToken;

        AuditLogService::logForUser($user, 'LOGIN_SUCCESS', 'User logged in: ' . $user->full_name, 'INFO', [
            'email' => $user->email,
            'role' => $user->workflowRole(),
        ], $request);

        return response()->json([
            'user' => new UserResource($user->load('roles')),
            'token' => $token,
            'token_type' => 'Bearer',
        ]);
    }

    private function loginThrottleKey(Request $request): string
    {
        $email = \Illuminate\Support\Str::lower((string) $request->input('email'));

        return hash_hmac('sha256', $email, (string) config('app.key'));
    }

    private function loginLockoutSeconds(string $key): int
    {
        if ($this->shouldUseRedisLoginLockout()) {
            return RateLimiter::tooManyAttempts($key, 6)
                ? max(1, RateLimiter::availableIn($key))
                : 0;
        }

        if (Schema::hasTable('login_lockouts')) {
            $record = DB::table('login_lockouts')->where('key', $key)->first();
            if (! $record) {
                return 0;
            }

            $now = now();
            $lockedUntil = $record->locked_until
                ? \Illuminate\Support\Carbon::parse($record->locked_until)
                : null;

            if ($lockedUntil && $now->lessThan($lockedUntil)) {
                return max(1, $lockedUntil->getTimestamp() - $now->getTimestamp());
            }

            if ($now->greaterThanOrEqualTo(\Illuminate\Support\Carbon::parse($record->expires_at))) {
                DB::table('login_lockouts')->where('key', $key)->delete();
            }

            return 0;
        }

        if (! Schema::hasTable('cache')) {
            return 0;
        }

        $record = DB::table('cache')->where('key', $this->loginCacheKey($key))->first();
        if (! $record) {
            return 0;
        }

        $now = now();
        if ((int) $record->expiration <= $now->getTimestamp()) {
            DB::table('cache')->where('key', $this->loginCacheKey($key))->delete();
            return 0;
        }

        $value = json_decode((string) $record->value, true) ?: [];
        $lockedUntil = (int) ($value['locked_until'] ?? 0);

        if ($lockedUntil > $now->getTimestamp()) {
            return max(1, $lockedUntil - $now->getTimestamp());
        }

        DB::table('cache')->where('key', $this->loginCacheKey($key))->delete();

        return 0;
    }

    private function recordFailedLogin(string $key): int
    {
        if ($this->shouldUseRedisLoginLockout()) {
            RateLimiter::hit($key, 59);

            return RateLimiter::tooManyAttempts($key, 6)
                ? max(1, RateLimiter::availableIn($key))
                : 0;
        }

        if (Schema::hasTable('login_lockouts')) {
            return DB::transaction(function () use ($key) {
                $now = now();
                $windowEndsAt = $now->copy()->addSeconds(59);
                $record = DB::table('login_lockouts')->where('key', $key)->lockForUpdate()->first();
                $attempts = 0;

                if ($record && $now->lessThan(\Illuminate\Support\Carbon::parse($record->expires_at))) {
                    $attempts = (int) $record->attempts;
                }

                $attempts++;
                $payload = [
                    'attempts' => min($attempts, 6),
                    'locked_until' => $attempts >= 6 ? $windowEndsAt : null,
                    'expires_at' => $windowEndsAt,
                    'updated_at' => $now,
                ];

                if ($record) {
                    DB::table('login_lockouts')->where('key', $key)->update($payload);
                } else {
                    DB::table('login_lockouts')->insert(array_merge($payload, [
                        'key' => $key,
                        'created_at' => $now,
                    ]));
                }

                return $attempts >= 6 ? 59 : 0;
            });
        }

        if (! Schema::hasTable('cache')) {
            RateLimiter::hit($key, 59);

            return RateLimiter::tooManyAttempts($key, 6)
                ? 59
                : 0;
        }

        return DB::transaction(function () use ($key) {
            $now = now();
            $expiresAt = $now->copy()->addSeconds(59)->getTimestamp();
            $cacheKey = $this->loginCacheKey($key);
            $record = DB::table('cache')->where('key', $cacheKey)->lockForUpdate()->first();
            $attempts = 0;

            if ($record && (int) $record->expiration > $now->getTimestamp()) {
                $value = json_decode((string) $record->value, true) ?: [];
                $attempts = (int) ($value['attempts'] ?? 0);
            }

            $attempts++;
            $lockedUntil = $attempts >= 6 ? $expiresAt : null;
            $payload = [
                'value' => json_encode([
                    'attempts' => min($attempts, 6),
                    'locked_until' => $lockedUntil,
                ]),
                'expiration' => $expiresAt,
            ];

            if ($record) {
                DB::table('cache')->where('key', $cacheKey)->update($payload);
            } else {
                DB::table('cache')->insert(array_merge($payload, [
                    'key' => $cacheKey,
                ]));
            }

            return $attempts >= 6 ? 59 : 0;
        });
    }

    private function clearFailedLogins(string $key): void
    {
        if ($this->shouldUseRedisLoginLockout()) {
            RateLimiter::clear($key);
            return;
        }

        if (Schema::hasTable('login_lockouts')) {
            DB::table('login_lockouts')->where('key', $key)->delete();
            return;
        }

        if (Schema::hasTable('cache')) {
            DB::table('cache')->where('key', $this->loginCacheKey($key))->delete();
            return;
        }

        RateLimiter::clear($key);
    }

    private function loginCacheKey(string $key): string
    {
        return 'login_lockout:' . $key;
    }

    private function shouldUseRedisLoginLockout(): bool
    {
        return config('cache.default') === 'redis';
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create([
            'employee_id' => $request->employee_id,
            'first_name' => $request->first_name,
            'middle_name' => $request->middle_name,
            'last_name' => $request->last_name,
            'email' => $request->email,
            'password' => $request->password, // Hashed automatically by model's 'hashed' cast
            'phone' => $request->phone,
            'department' => $request->department,
            'position' => $request->position,
            'status' => 'active',
        ]);

        if ($request->role) {
            $user->assignRole($request->role);
        }

        $token = $user->createToken('postflow-api')->plainTextToken;

        AuditLogService::logForUser($user, 'ACCOUNT_REGISTERED', 'New account registered: ' . $user->full_name, 'INFO', [
            'email' => $user->email,
            'role' => $request->role,
        ], $request);

        return response()->json([
            'user' => new UserResource($user->load('roles')),
            'token' => $token,
            'token_type' => 'Bearer',
        ], 201);
    }

    public function logout(Request $request): JsonResponse
    {
        AuditLogService::logForUser($request->user(), 'LOGOUT', 'User logged out: ' . $request->user()->full_name, 'INFO', [
            'email' => $request->user()->email,
        ], $request);

        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Successfully logged out',
        ]);
    }

    public function user(Request $request): JsonResponse
    {
        return response()->json([
            'user' => new UserResource($request->user()->load('roles')),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        
        $validated = $request->validate([
            'first_name' => 'sometimes|string|max:255',
            'middle_name' => 'nullable|string|max:255',
            'last_name' => 'sometimes|string|max:255',
            'phone' => 'nullable|string|max:20',
        ]);

        $user->update($validated);

        AuditLogService::logForUser($user, 'PROFILE_UPDATED', 'Updated own profile details: ' . $user->full_name, 'INFO', [
            'fields' => array_keys($validated),
        ], $request);

        return response()->json([
            'user' => new UserResource($user->load('roles')),
        ]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();

        if (! Hash::check($request->current_password, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user->update([
            'password' => Hash::make($request->new_password),
        ]);

        AuditLogService::logForUser($user, 'PASSWORD_UPDATED', 'Updated own password: ' . $user->full_name, 'WARNING', [
            'email' => $user->email,
        ], $request);

        // Revoke all tokens except current
        $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();

        return response()->json([
            'message' => 'Password updated successfully',
        ]);
    }

    public function uploadPhoto(Request $request): JsonResponse
    {
        $request->validate([
            'photo' => 'required|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        $user = $request->user();

        $disk = config('filesystems.default') === 'local' ? 'public' : config('filesystems.default');

        if ($user->photo_path && Storage::disk($disk)->exists($user->photo_path)) {
            Storage::disk($disk)->delete($user->photo_path);
        }

        $path = $request->file('photo')->store('profile-photos', $disk);
        $user->update(['photo_path' => $path]);

        $user->refresh();

        AuditLogService::logForUser($user, 'PROFILE_PHOTO_UPDATED', 'Updated profile photo: ' . $user->full_name, 'INFO', [
            'path' => $path,
        ], $request);

        return response()->json([
            'message' => 'Photo uploaded.',
            'photo_url' => $user->photo_url,
            'user' => new UserResource($user->load('roles')),
        ]);
    }

    public function removePhoto(Request $request): JsonResponse
    {
        $user = $request->user();

        $disk = config('filesystems.default') === 'local' ? 'public' : config('filesystems.default');

        if ($user->photo_path && Storage::disk($disk)->exists($user->photo_path)) {
            Storage::disk($disk)->delete($user->photo_path);
        }
        $user->update(['photo_path' => null]);

        AuditLogService::logForUser($user, 'PROFILE_PHOTO_REMOVED', 'Removed profile photo: ' . $user->full_name, 'INFO', [
            'email' => $user->email,
        ], $request);

        return response()->json([
            'message' => 'Photo removed.',
            'photo_url' => null,
            'user' => new UserResource($user->fresh()->load('roles')),
        ]);
    }
}
