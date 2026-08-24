#!/bin/sh
set -e

exec php artisan queue:work --memory=128 --sleep=3 --tries=3 --max-time=3600
