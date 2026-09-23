# Production Redis

Redis is used for Laravel cache and publishing queues. PostgreSQL remains the
source of truth for users, posts, tokens, and failed jobs; object storage is unchanged.

## Railway configuration

Create a Redis service in the same project and production environment as the app.
Use private networking, password authentication, and a persistent volume at `/data`.
Enable AOF persistence (`--appendonly yes --appendfsync everysec`) and use
`--maxmemory-policy noeviction` because this instance also stores jobs. The initial
memory limit is 256 MB. Monitor usage and increase capacity before it fills.
Do not expose Redis with a public TCP proxy.

Set these variables on the app service (not in source control):

```dotenv
REDIS_URL=${{Redis.REDIS_URL}}
REDIS_CLIENT=phpredis
REDIS_DB=0
REDIS_CACHE_DB=1
CACHE_STORE=redis
CACHE_DRIVER=redis
QUEUE_CONNECTION=redis
REDIS_QUEUE_RETRY_AFTER=180
DB_QUEUE_RETRY_AFTER=180
QUEUE_NAMES=publishing,default
```

The Redis service URL must not contain a database path so Laravel can select
database 0 for queues/locks and database 1 for cache. Keep APP_KEY, database,
storage, and session configuration unchanged.

The Docker entrypoint runs migrations and optimization, then starts Supervisor.
Supervisor runs the web server and restarts the queue worker after its hourly
recycle, memory-limit exit, or `php artisan queue:restart`. The 180-second retry
window is longer than the 120-second job timeout to avoid concurrent retries.

## Verification and cutover

- Check the old database `jobs` table before and after deployment, including
  delayed/reserved jobs. Switching drivers does not move existing jobs.
- If old jobs remain, drain them with a database worker only after checking their
  purpose. Do not automatically retry historical failed publishing jobs.
- Verify Redis cache write/read/delete and locks from the deployed application.
- Queue a harmless Artisan command such as `env` on the default queue, confirm
  successful processing, and confirm failed-job counts have not increased.
- Run `php artisan queue:restart` and confirm the supervised worker gets a new PID.
- Confirm the frontend, health endpoint, authenticated dashboard, and data counts.

Inspect processes with:

```sh
supervisorctl -c /app/docker/supervisord.conf status
```

## Rollback and operations

Do not flush Redis or delete its volume: that can destroy queued jobs and locks.
For rollback, pause new publishing, drain Redis jobs, then switch CACHE_STORE,
CACHE_DRIVER and QUEUE_CONNECTION to database and redeploy. Redis can remain
online until there are no delayed, reserved, or waiting jobs.

AOF every-second persistence can lose roughly the last second of writes on an
abrupt failure; this single instance is not a high-availability queue. Monitor
Railway resource usage, Redis persistence errors, and Laravel failed jobs. Redis
adds a separately billed service/volume; no performance percentage is guaranteed.
