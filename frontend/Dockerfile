# Development-focused Dockerfile for the Vite + React frontend
# Uses Node.js to install dependencies and run the Vite dev server.
# The project's docker-compose mounts the project into /app and a
# volume for /app/node_modules so this image is optimized for local dev.

FROM node:22-alpine

WORKDIR /app

# Put node_modules on PATH so CLI tools installed locally are available
ENV PATH /app/node_modules/.bin:$PATH

# Install dependencies (use package-lock.json if present for reproducible installs)
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --silent --no-audit --no-fund; \
    else \
      npm install --silent --no-audit --no-fund; \
    fi

# Copy source files
COPY . .

# Expose the default Vite dev port
EXPOSE 5173

# Default command: run Vite dev server and listen on all interfaces so
# it is reachable from the host and other containers. Docker Compose
# mounts the local source so code changes are reflected immediately.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
