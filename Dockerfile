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
# STAGE 2: Setup Vanilla PHP and Laravel
# ==========================================
FROM php:8.2-alpine

# Install system dependencies and PHP extensions for Laravel
RUN apk add --no-cache \
    curl \
    libpng-dev \
    libxml2-dev \
    zip \
    unzip \
    postgresql-dev \
    linux-headers \
    && docker-php-ext-install pdo pdo_pgsql bcmath pcntl sockets

# Install Composer securely
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy backend files
COPY backend/ ./

# Ensure required Laravel directories exist and are writable before composer install
RUN mkdir -p bootstrap/cache storage/logs storage/framework/views storage/framework/cache storage/framework/sessions resources/views \
    && chmod -R 777 bootstrap/cache storage

# Install Composer Dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# Copy the built frontend from STAGE 1 into Laravel's public directory
COPY --from=frontend-builder /app/frontend-rn/dist/ ./public/

# Create storage symlink
RUN php artisan storage:link

# Explicitly tell Railway's Edge Proxy which port we use
EXPOSE 8080

# Start the application using raw PHP built-in server bound to IPv6 ([::])
# Railway's internal network connects via IPv6, binding to 0.0.0.0 causes 502s
CMD php -S [::]:${PORT:-8080} -t public server.php
