FROM php:8.3-apache

ARG WKHTMLTOPDF_VERSION=0.12.6-1
ARG WKHTMLTOPDF_DISTRO=buster
ARG WKHTMLTOPDF_ARCH=amd64
ARG WKHTMLTOPDF_PACKAGE=wkhtmltox_${WKHTMLTOPDF_VERSION}.${WKHTMLTOPDF_DISTRO}_${WKHTMLTOPDF_ARCH}.deb

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    libzip-dev \
    libfreetype6-dev \
    libjpeg62-turbo-dev \
    libpng-dev \
    supervisor \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) gd pdo pdo_mysql zip exif pcntl bcmath

# Clear cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Install wkhtmltopdf (Bookworm packages removals workaround)
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        fontconfig \
        libjpeg62-turbo \
        libxrender1 \
        libxext6 \
        xfonts-75dpi \
        xfonts-base; \
    curl -L --fail -o /tmp/${WKHTMLTOPDF_PACKAGE} https://github.com/wkhtmltopdf/packaging/releases/download/${WKHTMLTOPDF_VERSION}/${WKHTMLTOPDF_PACKAGE}; \
    dpkg -i /tmp/${WKHTMLTOPDF_PACKAGE} || apt-get install -f -y; \
    rm -f /tmp/${WKHTMLTOPDF_PACKAGE}; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Apache config
RUN a2enmod rewrite

# Set working directory
WORKDIR /var/www/html

# Copy entrypoint scripts first (as root)
COPY docker-entrypoint.sh /usr/local/bin/
COPY queue-entrypoint.sh /usr/local/bin/

# Make entrypoint scripts executable
RUN chmod +x /usr/local/bin/docker-entrypoint.sh /usr/local/bin/queue-entrypoint.sh

# Copy existing application directory contents
COPY . /var/www/html

# Copy existing application directory permissions
COPY --chown=www-data:www-data . /var/www/html

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader --no-scripts

# Change ownership
RUN chown -R www-data:www-data /var/www/html

# Change current user
USER www-data

EXPOSE 8000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
