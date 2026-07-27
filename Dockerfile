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
FROM webdevops/php-nginx:8.2-alpine
ENV WEB_DOCUMENT_ROOT=/app/public \
    WEB_DOCUMENT_INDEX=index.php \
    PHP_DATE_TIMEZONE=UTC \
    APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr

WORKDIR /app

# Copy backend files
COPY backend/ ./

# Ensure required Laravel directories exist and are writable before composer install
RUN mkdir -p bootstrap/cache storage/logs storage/framework/views storage/framework/cache storage/framework/sessions resources/views \
    && chmod -R 777 bootstrap/cache storage

# Install Composer Dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# Copy the built frontend from STAGE 1 into Laravel's public directory
COPY --from=frontend-builder /app/frontend-rn/dist/ ./public/

# Set correct permissions for Laravel
RUN chown -R application:application /app \
    && chmod -R 775 /app/storage /app/bootstrap/cache

# Run Laravel optimizations
RUN php artisan config:cache \
    && php artisan route:cache

# Expose port 80 (default for webdevops)
EXPOSE 80
