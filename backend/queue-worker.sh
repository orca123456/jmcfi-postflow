#!/bin/sh
set -e

exec php artisan queue:work "${QUEUE_CONNECTION:-redis}" --queue="${QUEUE_NAMES:-publishing,default}" --memory=128 --sleep=3 --tries=3 --timeout=120 --max-time=3600
