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
# STAGE 2: Setup PHP and Laravel
# ==========================================
FROM serversideup/php:8.2-cli

# Configure for production
ENV PHP_OPCACHE_ENABLE=1 \
    APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr

# We must run as root to copy files and set permissions
USER root

WORKDIR /var/www/html

# Install required PHP extensions (like sockets for amqplib)
RUN install-php-extensions sockets

# Copy backend files
COPY backend/ ./

# Ensure required Laravel directories exist so composer scripts don't fail
RUN mkdir -p bootstrap/cache storage/logs storage/framework/views storage/framework/cache storage/framework/sessions resources/views

# Install Composer Dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# Copy the built frontend from STAGE 1 into Laravel's public directory
COPY --from=frontend-builder /app/frontend-rn/dist/ ./public/

# Set correct ownership for the web server
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 775 bootstrap/cache storage

# Switch back to the unprivileged user for security
USER www-data

# Create storage symlink
RUN php artisan storage:link

# Start the application using Laravel's built-in server on Railway's dynamic port
CMD ["sh", "-c", "php artisan serve --host=0.0.0.0 --port=${PORT:-8080}"]
