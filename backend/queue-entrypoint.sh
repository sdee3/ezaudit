#!/bin/bash
set -e

echo "Starting queue worker setup..."

# Wait for database to be ready
echo "Waiting for database connection..."
until php artisan migrate:status 2>/dev/null; do
    echo "Database not ready yet, waiting..."
    sleep 2
done

# Wait for Redis to be ready
echo "Waiting for Redis connection..."
until php artisan tinker --execute="Redis::ping();" 2>/dev/null; do
    echo "Redis not ready yet, waiting..."
    sleep 2
done

echo "Queue worker setup completed!"

# Execute the main command with proper signal handling
exec "$@"
