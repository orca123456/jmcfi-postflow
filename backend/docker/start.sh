#!/bin/sh
set -eu

cd /app
export QUEUE_CONNECTION="${QUEUE_CONNECTION:-database}"
export QUEUE_NAMES="${QUEUE_NAMES:-publishing,default}"

if { [ "$QUEUE_CONNECTION" = "redis" ] || [ "${CACHE_STORE:-${CACHE_DRIVER:-}}" = "redis" ]; } && [ -z "${REDIS_URL:-}" ] && [ -z "${REDIS_HOST:-}" ]; then
    echo "Redis is enabled but no connection is configured; falling back to database queue/cache."
    export QUEUE_CONNECTION=database CACHE_STORE=database CACHE_DRIVER=database
fi

export QUEUE_WORKER_ENABLED=true
if [ "$QUEUE_CONNECTION" = "sync" ]; then
    export QUEUE_WORKER_ENABLED=false
fi

php artisan storage:link --force >/dev/null 2>&1 || true
php artisan migrate --force
php artisan optimize --quiet

exec supervisord -c /app/docker/supervisord.conf
