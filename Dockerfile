# ==========================================
# STAGE 1: Build the React Native (Expo) Web App
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend-rn
# Copy frontend source
COPY frontend-rn/package*.json ./
RUN npm install
COPY frontend-rn/ ./
# Build for web (output goes to /app/frontend-rn/dist)
RUN npx expo export -p web

# ==========================================
# STAGE 2: Setup PHP/Nginx and Laravel
# ==========================================
FROM serversideup/php:8.2-fpm-nginx

# Configure for production
ENV PHP_OPCACHE_ENABLE=1 \
    APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr

# We must run as root to copy files and set permissions
USER root

WORKDIR /var/www/html

# Copy backend files
COPY backend/ ./

# Install Composer Dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# Copy the built frontend from STAGE 1 into Laravel's public directory
COPY --from=frontend-builder /app/frontend-rn/dist/ ./public/

# Ensure required Laravel directories exist and are writable
RUN mkdir -p bootstrap/cache storage/logs storage/framework/views storage/framework/cache storage/framework/sessions resources/views \
    && chown -R www-data:www-data /var/www/html \
    && chmod -R 775 bootstrap/cache storage

# Switch back to the unprivileged user for security
USER www-data

# Create storage symlink
RUN php artisan storage:link
