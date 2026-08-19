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

# Create storage symlink
RUN php artisan storage:link

# Explicitly tell Railway to route to port 8080
EXPOSE 8080

# Configure FrankenPHP to listen on the port Railway provides, or 8080 as fallback
# FrankenPHP automatically serves the /app/public directory perfectly using Caddy (HTTP/2, Keep-Alive, etc.)
CMD ["sh", "-c", "SERVER_NAME=\":${PORT:-8080}\" frankenphp run --config /etc/caddy/Caddyfile"]
