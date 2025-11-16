#!/bin/bash
set -e

echo "Starting Laravel application setup..."

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
fi

# Wait for database to be ready
echo "Waiting for database connection..."
until php artisan migrate:status 2>/dev/null; do
    echo "Database not ready yet, waiting..."
    sleep 2
done

# Generate application key if not set
if [ -z "$APP_KEY" ] || ! grep -q "^APP_KEY=base64:" .env 2>/dev/null; then
    echo "Generating application key..."
    php artisan key:generate --force
else
    echo "Application key already set"
fi

# Generate JWT secret if not set
if ! grep -q "^JWT_SECRET=" .env 2>/dev/null || [ -z "$(grep '^JWT_SECRET=' .env | cut -d '=' -f2)" ]; then
    echo "Generating JWT secret..."
    php artisan jwt:secret --force
else
    echo "JWT secret already set"
fi

# Run migrations
echo "Running database migrations..."
php artisan migrate --force

# Create storage link if it doesn't exist
if [ ! -L "public/storage" ]; then
    echo "Creating storage link..."
    php artisan storage:link
fi

# Clear and cache config
echo "Optimizing application..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "Laravel application setup completed!"

# Execute the main command
exec "$@"
