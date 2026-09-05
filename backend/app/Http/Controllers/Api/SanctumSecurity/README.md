# Sanctum Security

This folder contains the API authentication controller used by Laravel Sanctum.

Related security files:

- `AuthController.php` handles login, register, logout, current user, profile, password, profile photo, and login lockout.
- `backend/routes/api.php` maps the `/api/auth/*` routes and applies `auth:sanctum`.
- `backend/config/sanctum.php` configures Sanctum guards, stateful domains, and middleware.
- `backend/app/Models/User.php` enables Sanctum tokens through `HasApiTokens`.
- `backend/app/Http/Middleware/CheckRole.php` protects role-only routes after authentication.
