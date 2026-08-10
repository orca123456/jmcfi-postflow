<?php

namespace App\Providers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Strict database/model safety:
        // - Throw on attempting to fill unfillable attributes (no silent failures)
        // - Throw when lazy-loading relationships (catches N+1 and accidental queries)
        // - Throw on silently discarding attribute changes
        Model::shouldBeStrict();

        // Enforce HTTPS URLs in production to prevent mixed content / MITM.
        // (Local/dev stays HTTP — see .env APP_ENV.)
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }
    }
}
