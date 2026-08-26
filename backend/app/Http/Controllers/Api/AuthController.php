<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Auth\LoginRequest;
use App\Http\Requests\Api\Auth\RegisterRequest;
use App\Http\Resources\Api\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $throttleKey = \Illuminate\Support\Str::transliterate(\Illuminate\Support\Str::lower($request->input('email')).'|'.$request->ip());

        if (\Illuminate\Support\Facades\RateLimiter::tooManyAttempts($throttleKey, 6)) {
            $timerKey = $throttleKey.':timer';
            if (!\Illuminate\Support\Facades\Cache::has($timerKey)) {
                // If the lockout just happened but timer isn't set, set it for 59s
                \Illuminate\Support\Facades\Cache::put($timerKey, \Illuminate\Support\Carbon::now()->addSeconds(59)->getTimestamp(), 59);
            }
            
            $expiresAt = \Illuminate\Support\Facades\Cache::get($timerKey);
            $seconds = max(1, $expiresAt - \Illuminate\Support\Carbon::now()->getTimestamp());

            return response()->json([
                'message' => 'Too many login attempts. Please try again in ' . $seconds . ' seconds.',
                'retry_after' => $seconds
            ], 429);
        }

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            \Illuminate\Support\Facades\RateLimiter::hit($throttleKey, 59);

            // Start the visible lockout immediately on the 6th failed attempt.
            if (\Illuminate\Support\Facades\RateLimiter::attempts($throttleKey) >= 6) {
                $retryAfter = 59;
                \Illuminate\Support\Facades\Cache::put(
                    $throttleKey.':timer',
                    \Illuminate\Support\Carbon::now()->addSeconds($retryAfter)->getTimestamp(),
                    $retryAfter
                );

                return response()->json([
                    'message' => 'Too many login attempts. Please try again in ' . $retryAfter . ' seconds.',
                    'retry_after' => $retryAfter,
                ], 429);
            }

            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        \Illuminate\Support\Facades\RateLimiter::clear($throttleKey);

        if (! $user->isActive()) {
            return response()->json([
                'message' => 'Your account has been deactivated. Please contact administrator.',
            ], 403);
        }

        $token = $user->createToken('postflow-api')->plainTextToken;

        return response()->json([
            'user' => new UserResource($user->load('roles')),
            'token' => $token,
            'token_type' => 'Bearer',
        ]);
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

        return response()->json([
            'user' => new UserResource($user->load('roles')),
            'token' => $token,
            'token_type' => 'Bearer',
        ], 201);
    }

    public function logout(Request $request): JsonResponse
    {
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

        return response()->json([
            'message' => 'Photo removed.',
            'photo_url' => null,
            'user' => new UserResource($user->fresh()->load('roles')),
        ]);
    }
}
