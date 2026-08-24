# ==========================================
# STAGE 1: Build React Native Web Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend-rn
COPY frontend-rn/package*.json ./
RUN npm install
COPY frontend-rn/ ./
RUN npx expo export -p web

# ==========================================
# STAGE 2: Setup FrankenPHP and Laravel
# ==========================================
FROM dunglas/frankenphp:1-php8.2-alpine

# Install PHP extensions required by your Laravel app
RUN install-php-extensions \
    pdo_pgsql \
    bcmath \
    pcntl \
    sockets \
    redis \
    gd \
    zip

# Keep PHP predictable on a 1GB container and reserve memory for the OS/database
# connection overhead. FrankenPHP does not use php-fpm, so pm.max_children is not
# applicable here; these limits are the effective low-memory tuning for this image.
RUN printf '%s\n' \
    'memory_limit=128M' \
    'opcache.enable=1' \
    'opcache.enable_cli=1' \
    'opcache.memory_consumption=64' \
    'opcache.max_accelerated_files=10000' \
    'opcache.validate_timestamps=0' \
    'realpath_cache_size=4096K' \
    'realpath_cache_ttl=600' \
    > /usr/local/etc/php/conf.d/zz-production.ini

# Install Composer securely
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# FrankenPHP expects the app to be in /app
WORKDIR /app

# Copy backend files
COPY backend/ ./

# Ensure required Laravel directories exist and are writable
RUN mkdir -p bootstrap/cache storage/logs storage/framework/views storage/framework/cache storage/framework/sessions resources/views \
    && chmod -R 777 bootstrap/cache storage

# Install Composer Dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# Copy the built frontend from STAGE 1 into Laravel's public directory
COPY --from=frontend-builder /app/frontend-rn/dist/ ./public/

# Use the app's Caddyfile instead of the image default so startup logs stay clean.
COPY Caddyfile /etc/caddy/Caddyfile

# Create storage symlink
RUN php artisan storage:link --force

# Explicitly tell Railway to route to port 8080
EXPOSE 8080

# Configure FrankenPHP to listen on the port Railway provides, or 8080 as fallback
# FrankenPHP automatically serves the /app/public directory perfectly using Caddy (HTTP/2, Keep-Alive, etc.)
CMD ["sh", "-c", "php artisan storage:link --force >/dev/null 2>&1 || true; php artisan config:cache --quiet; php artisan view:cache --quiet; php artisan optimize --quiet; frankenphp run --config /etc/caddy/Caddyfile"]
