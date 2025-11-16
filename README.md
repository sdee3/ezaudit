# EZAudit - Website Performance Audit Tool

EZAudit is a web application that allows users to generate PDF performance reports for their websites using Google's Lighthouse. The system features user authentication, queued audit processing, real-time status updates, and PDF downloads.

## Architecture

- **Backend**: Laravel 11.x with MySQL database, JWT authentication, queue jobs for Lighthouse audits, PDF generation with Snappy, and real-time broadcasting with Laravel Echo/Pusher.
- **Frontend**: React with Vite build tool, Chakra UI for UI components, React Router for navigation, Axios for API calls, and Laravel Echo for real-time updates.
- **Database**: MySQL for user data and audit records.
- **Queue & Broadcasting**: Redis for queues and real-time events.
- **Development**: Docker Compose for local setup.

## Features

- User registration and login with JWT tokens
- Submit website audits (domain + email)
- Queued processing with Lighthouse integration
- Real-time dashboard updates via WebSockets
- PDF report generation and download
- Responsive UI with Chakra UI

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for manual frontend setup)
- PHP 8.3+ and Composer (for manual backend setup)

## Quick Start with Docker

1. **Clone the repository** (if not already):

   ```bash
   git clone <repo-url>
   cd ezaudit
   ```

2. **Build and start services**:

   ```bash
   docker compose up -d --build
   ```

   This will:
   - Build all Docker images
   - Start all containers (Laravel, MySQL, Redis, Queue Worker, Frontend)
   - Automatically run Laravel setup (key generation, migrations, cache optimization)
   - Start the queue worker in a separate container

3. **Access the application**:
   - Frontend: <http://localhost:5173>
   - Backend API: <http://localhost:8000/api>
   - phpMyAdmin (optional): <http://localhost:8080> (add to docker-compose if needed)

4. **View logs** (optional):

   ```bash
   # All services
   docker compose logs -f
   
   # Specific service
   docker compose logs -f laravel
   docker compose logs -f queue
   ```

### What Happens Automatically

The Laravel container automatically handles:

- Application key generation (`php artisan key:generate`)
- Database migrations (`php artisan migrate`)
- Storage link creation (`php artisan storage:link`)
- Configuration caching for optimal performance

The queue worker runs in a separate container and automatically:

- Waits for database and Redis to be ready
- Processes queued audit jobs continuously
- Restarts on failure

## Manual Setup (Without Docker)

### Backend (Laravel)

1. **Install dependencies**:

   ```
   cd backend
   composer install
   cp .env.example .env
   php artisan key:generate
   php artisan jwt:secret
   ```

2. **Configure environment** (`.env`):

   ```
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=ezaudit
   DB_USERNAME=root
   DB_PASSWORD=

   BROADCAST_DRIVER=pusher
   PUSHER_APP_ID=local
   PUSHER_APP_KEY=local
   PUSHER_APP_SECRET=local
   PUSHER_APP_CLUSTER=mt1

   QUEUE_CONNECTION=redis
   REDIS_HOST=127.0.0.1
   REDIS_PASSWORD=null
   REDIS_PORT=6379
   ```

3. **Setup database**:
   - Create MySQL database `ezaudit`
   - Run migrations: `php artisan migrate`

4. **Start server**:

   ```
   php artisan serve
   ```

5. **Start queue** (separate terminal):

   ```
   php artisan queue:work
   ```

### Frontend (React)

1. **Install dependencies**:

   ```
   cd frontend
   npm install
   ```

2. **Configure environment** (`.env`):

   ```
   VITE_API_URL=http://localhost:8000/api
   VITE_PUSHER_APP_KEY=local
   VITE_PUSHER_APP_CLUSTER=mt1
   VITE_PUSHER_HOST=127.0.0.1
   VITE_PUSHER_PORT=6001
   VITE_PUSHER_SCHEME=http
   ```

3. **Start development server**:

   ```
   npm run dev
   ```

## API Endpoints

All endpoints are under `/api` and use JWT authentication (except login/register).

- **Auth**:
  - POST `/login` - Login user (email, password)
  - POST `/register` - Register user (name, email, password, password_confirmation)
  - POST `/logout` - Logout (requires token)
  - GET `/me` - Get current user (requires token)

- **Audits**:
  - POST `/audits` - Submit new audit (domain, email) - requires auth
  - GET `/audits` - List user's audits (optional ?status=pending|processing|completed|failed)
  - GET `/audits/{id}` - Get specific audit
  - GET `/audits/{id}/download` - Download PDF (requires token)

## Project Structure

```
ezaudit/
├── backend/                 # Laravel backend
│   ├── app/                 # Models, Controllers, Jobs, Events
│   ├── config/              # Configuration files
│   ├── database/            # Migrations, Seeders
│   ├── routes/              # API and channel routes
│   └── resources/views/pdf/ # PDF templates
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/      # Reusable components (PrivateRoute)
│   │   ├── contexts/        # AuthContext
│   │   ├── hooks/           # Custom hooks (useEcho)
│   │   ├── pages/           # Page components (Home, Login, etc.)
│   │   ├── services/        # API services (authService, auditService)
│   │   └── types/           # TypeScript interfaces
│   └── public/              # Static assets (images, manifest)
├── docker-compose.yml       # Docker configuration
├── MIGRATION_STATUS.md      # Migration documentation
└── README.md                # This file
```

## Testing

### Backend Tests

Run PHPUnit tests:

```
cd backend
php artisan test
```

### Frontend Tests

Run Jest tests:

```
cd frontend
npm run test
```

### End-to-End Flow

1. Register a new user at <http://localhost:5173/register>
2. Login at <http://localhost:5173/login>
3. Submit an audit at <http://localhost:5173> (home page)
4. View real-time updates in dashboard at <http://localhost:5173/dashboard>
5. Download PDF when completed

## Continuous Integration

Two GitHub Actions workflows keep code quality high:

- [`frontend-ci.yml`](.github/workflows/frontend-ci.yml): Installs Node 20, runs `npm ci`, then executes `npm run lint` and `npm run test` (if defined) inside the `frontend` directory.
- [`backend-ci.yml`](.github/workflows/backend-ci.yml): Installs PHP 8.3, sets up a SQLite database, runs Pint via `./vendor/bin/pint --test`, and executes the Laravel test suite with `php artisan test`.

Both workflows trigger on pushes, pull requests, and manual dispatches scoped to their respective subdirectories.

## Lighthouse Integration

The `ProcessAuditJob` calls an external Lighthouse service. Update the `LIGHTHOUSE_URL` in backend `.env` to point to your Lighthouse API endpoint.

## Deployment

For production:

1. **Backend**:
   - Use Laravel Forge or Vapor for deployment
   - Configure production database and Redis
   - Set up Supervisor for queue workers
   - Configure Pusher for production broadcasting

2. **Frontend**:
   - Build with `npm run build`
   - Serve static files with Nginx or CDN
   - Update VITE_API_URL to production backend URL

3. **Database**:
   - Use managed MySQL (RDS, PlanetScale)
   - Run migrations on deployment

## Troubleshooting

- **Queue not processing**: Check queue worker logs with `docker compose logs queue`. Ensure Redis is connected.
- **"Secret is not set" error**: Restart Laravel container to regenerate APP_KEY: `docker compose restart laravel`
- **Real-time updates not working**: Check Pusher credentials and broadcasting config. Verify channel authorization.
- **PDF generation fails**: Ensure wkhtmltopdf is installed correctly in the Docker image.
- **CORS errors**: Laravel Sanctum is configured for API; ensure frontend domain is allowed.
- **Database connection issues**: Wait for MySQL to be fully ready (health check). View logs: `docker compose logs mysql`
- **Container won't start**: Rebuild images: `docker compose down && docker compose up -d --build`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Open a Pull Request

## License

This project is open-source and available under the MIT License.
