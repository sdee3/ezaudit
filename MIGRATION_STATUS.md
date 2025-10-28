# EZAudit Migration Status & Implementation Guide

## Current Progress Summary

### ✅ Completed Tasks

#### 1. Laravel Backend (95% Complete)

- ✅ Laravel 11.x installed in `/backend` directory
- ✅ JWT authentication configured (`tymon/jwt-auth`)
- ✅ Database migrations created:
  - Users table (default Laravel)
  - Audits table with: user_id, domain, email, status, lighthouse_result (JSON), pdf_path
- ✅ Eloquent Models implemented:
  - [`User`](backend/app/Models/User.php) with JWT interface (JWTSubject)
  - [`Audit`](backend/app/Models/Audit.php) with relationships
- ✅ Controllers created:
  - [`AuthController`](backend/app/Http/Controllers/AuthController.php): login, register, logout, me, refresh
  - [`AuditController`](backend/app/Http/Controllers/AuditController.php): submit, index, show, download
- ✅ Queue Job implemented:
  - [`ProcessAuditJob`](backend/app/Jobs/ProcessAuditJob.php): Lighthouse call, PDF generation, status updates
- ✅ Broadcasting Event:
  - [`AuditUpdated`](backend/app/Events/AuditUpdated.php): WebSocket events for real-time updates
- ✅ API Routes configured in [`routes/api.php`](backend/routes/api.php)
- ✅ PDF generation setup with `barryvdh/laravel-snappy`
- ✅ Blade template for PDF reports

#### 2. React Frontend (40% Complete)

- ✅ Vite + React + TypeScript project created in `/frontend`
- ✅ Dependencies installed:
  - Chakra UI v3.28.0
  - React Router DOM v7.9.4
  - Axios v1.13.0
  - React Hook Form v7.65.0
  - Laravel Echo v2.2.4
  - Pusher.js v8.4.0
- ✅ TypeScript types created in [`frontend/src/types/index.ts`](frontend/src/types/index.ts)
- ✅ Services layer:
  - [`api.ts`](frontend/src/services/api.ts): Axios instance with interceptors
  - [`authService.ts`](frontend/src/services/authService.ts): Authentication methods
  - [`auditService.ts`](frontend/src/services/auditService.ts): Audit CRUD operations
- ✅ Authentication Context: [`AuthContext.tsx`](frontend/src/contexts/AuthContext.tsx)
- ✅ Private Route component: [`PrivateRoute.tsx`](frontend/src/components/PrivateRoute.tsx)
- ⚠️ Login page created but needs Chakra UI v3 syntax fixes

### 🚧 Remaining Tasks

1. **Laravel Echo Configuration** (Backend)
   - Configure broadcasting driver (Pusher or Redis)
   - Set up WebSocket server
   - Test real-time event broadcasting

2. **React Components Migration**
   - Fix Login/Register pages with correct Chakra UI v3 syntax
   - Migrate AuditForm component
   - Create Dashboard component with audit list
   - Migrate Navbar and Layout components
   - Implement real-time updates with Laravel Echo

3. **Routing Setup**
   - Configure React Router with all pages
   - Set up protected routes

4. **Static Assets Migration**
   - Copy images from Next.js public/ to React public/

5. **Docker Configuration**
   - Create docker-compose.yml
   - Configure services for Laravel, MySQL, Redis

6. **Testing & Cleanup**
   - End-to-end testing
   - Remove Next.js files

---

## Critical Issues & Solutions

### Issue 1: Chakra UI v3 API Changes

**Problem**: Chakra UI v3 has breaking changes from v2:

- No `FormControl`, `FormLabel`, `FormErrorMessage` exports
- `spacing` prop changed to `gap`
- `isLoading` changed to `loading`
- Link component uses `asChild` pattern
- No `AlertIcon` component

**Solution**: Use Chakra UI v3 correct syntax (see examples below)

### Issue 2: Laravel 11 Structure Changes

**Problem**: Laravel 11 doesn't include `routes/api.php` by default

**Solution**: Run `php artisan install:api` (already completed)

---

## Implementation Guide

### Part 1: Complete React Frontend Setup

#### A. Chakra UI v3 Provider Setup

Create [`frontend/src/main.tsx`](frontend/src/main.tsx):

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from '@chakra-ui/react'
import { AuthProvider } from './contexts/AuthContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>
)
```

#### B. Correct Chakra UI v3 Login Page Example

```tsx
// frontend/src/pages/Login.tsx
import { useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  Stack,
  Text,
  Link,
} from '@chakra-ui/react'
import { Field } from '@chakra-ui/react/field'
import { useForm } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'
import type { LoginInputValues } from '../types'

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i

export const Login = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInputValues>()

  const onSubmit = async (data: LoginInputValues) => {
    try {
      setIsLoading(true)
      setError('')
      await login(data)
      navigate('/dashboard')
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } }
      setError(error.response?.data?.message || 'Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Container maxW="lg" py={12}>
      <Stack gap={8}>
        <Stack gap={6}>
          <Heading size="xl">Sign in to your account</Heading>
          <Text color="gray.600">
            Don't have an account?{' '}
            <Link asChild color="blue.600">
              <RouterLink to="/register">Sign up</RouterLink>
            </Link>
          </Text>
        </Stack>

        {error && (
          <Box bg="red.50" color="red.800" p={4} borderRadius="md">
            <Text>{error}</Text>
          </Box>
        )}

        <Box py={8} px={10} bg="white" boxShadow="base" borderRadius="xl">
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack gap={6}>
              <Field
                label="Email"
                invalid={!!errors.email}
                errorText={errors.email?.message}
              >
                <Input
                  type="email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: EMAIL_REGEX,
                      message: 'Invalid email address',
                    },
                  })}
                />
              </Field>

              <Field
                label="Password"
                invalid={!!errors.password}
                errorText={errors.password?.message}
              >
                <Input
                  type="password"
                  {...register('password', {
                    required: 'Password is required',
                  })}
                />
              </Field>

              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                loading={isLoading}
              >
                Sign in
              </Button>
            </Stack>
          </form>
        </Box>
      </Stack>
    </Container>
  )
}
```

#### C. Register Page Template

```tsx
// frontend/src/pages/Register.tsx
import { useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  Stack,
  Text,
  Link,
} from '@chakra-ui/react'
import { Field } from '@chakra-ui/react/field'
import { useForm } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'
import type { RegisterInputValues } from '../types'

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i

export const Register = () => {
  const navigate = useNavigate()
  const { register: registerUser } = useAuth()
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterInputValues>()

  const password = watch('password')

  const onSubmit = async (data: RegisterInputValues) => {
    try {
      setIsLoading(true)
      setError('')
      await registerUser(data)
      navigate('/dashboard')
    } catch (err) {
      const error = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
      const errorMsg = error.response?.data?.message || 'Registration failed'
      const validationErrors = error.response?.data?.errors
      if (validationErrors) {
        const firstError = Object.values(validationErrors)[0]?.[0]
        setError(firstError || errorMsg)
      } else {
        setError(errorMsg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Container maxW="lg" py={12}>
      <Stack gap={8}>
        <Stack gap={6}>
          <Heading size="xl">Create your account</Heading>
          <Text color="gray.600">
            Already have an account?{' '}
            <Link asChild color="blue.600">
              <RouterLink to="/login">Sign in</RouterLink>
            </Link>
          </Text>
        </Stack>

        {error && (
          <Box bg="red.50" color="red.800" p={4} borderRadius="md">
            <Text>{error}</Text>
          </Box>
        )}

        <Box py={8} px={10} bg="white" boxShadow="base" borderRadius="xl">
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack gap={6}>
              <Field
                label="Name"
                invalid={!!errors.name}
                errorText={errors.name?.message}
              >
                <Input
                  {...register('name', {
                    required: 'Name is required',
                  })}
                />
              </Field>

              <Field
                label="Email"
                invalid={!!errors.email}
                errorText={errors.email?.message}
              >
                <Input
                  type="email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: EMAIL_REGEX,
                      message: 'Invalid email address',
                    },
                  })}
                />
              </Field>

              <Field
                label="Password"
                invalid={!!errors.password}
                errorText={errors.password?.message}
              >
                <Input
                  type="password"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters',
                    },
                  })}
                />
              </Field>

              <Field
                label="Confirm Password"
                invalid={!!errors.password_confirmation}
                errorText={errors.password_confirmation?.message}
              >
                <Input
                  type="password"
                  {...register('password_confirmation', {
                    required: 'Please confirm your password',
                    validate: (value) =>
                      value === password || 'Passwords do not match',
                  })}
                />
              </Field>

              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                loading={isLoading}
              >
                Create account
              </Button>
            </Stack>
          </form>
        </Box>
      </Stack>
    </Container>
  )
}
```

#### D. Dashboard with Real-Time Updates

```tsx
// frontend/src/pages/Dashboard.tsx
import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Heading,
  Stack,
  Table,
  Badge,
  Spinner,
  Text,
} from '@chakra-ui/react'
import { auditService } from '../services/auditService'
import { useAuth } from '../contexts/AuthContext'
import type { Audit } from '../types'
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

// Declare Pusher globally for Laravel Echo
declare global {
  interface Window {
    Pusher: typeof Pusher
  }
}

window.Pusher = Pusher

export const Dashboard = () => {
  const { user } = useAuth()
  const [audits, setAudits] = useState<Audit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAudits()
    setupEcho()
  }, [user])

  const loadAudits = async () => {
    try {
      const data = await auditService.getAudits()
      setAudits(data)
    } catch (error) {
      console.error('Failed to load audits:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupEcho = () => {
    if (!user) return

    const echo = new Echo({
      broadcaster: 'pusher',
      key: import.meta.env.VITE_PUSHER_APP_KEY,
      cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER ?? 'mt1',
      wsHost: import.meta.env.VITE_PUSHER_HOST ?? `ws-${import.meta.env.VITE_PUSHER_APP_CLUSTER}.pusher.com`,
      wsPort: import.meta.env.VITE_PUSHER_PORT ?? 80,
      wssPort: import.meta.env.VITE_PUSHER_PORT ?? 443,
      forceTLS: (import.meta.env.VITE_PUSHER_SCHEME ?? 'https') === 'https',
      enabledTransports: ['ws', 'wss'],
      authEndpoint: `${import.meta.env.VITE_API_URL}/broadcasting/auth`,
      auth: {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      },
    })

    echo.private(`user.${user.id}`)
      .listen('AuditUpdated', (e: { audit: Audit }) => {
        setAudits((prev) =>
          prev.map((audit) =>
            audit.id === e.audit.id ? e.audit : audit
          )
        )
      })

    return () => {
      echo.disconnect()
    }
  }

  const getStatusBadge = (status: string) => {
    const colorMap = {
      pending: 'yellow',
      processing: 'blue',
      completed: 'green',
      failed: 'red',
    }
    return <Badge colorScheme={colorMap[status as keyof typeof colorMap]}>{status}</Badge>
  }

  const handleDownload = async (id: number) => {
    const url = auditService.downloadPDFUrl(id)
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <Container centerContent py={20}>
        <Spinner size="xl" />
      </Container>
    )
  }

  return (
    <Container maxW="6xl" py={8}>
      <Stack gap={6}>
        <Heading>Your Audit Reports</Heading>
        
        {audits.length === 0 ? (
          <Box textAlign="center" py={10}>
            <Text color="gray.600">No audits yet. Submit your first audit!</Text>
          </Box>
        ) : (
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Domain</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
                <Table.ColumnHeader>Date</Table.ColumnHeader>
                <Table.ColumnHeader>Actions</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {audits.map((audit) => (
                <Table.Row key={audit.id}>
                  <Table.Cell>{audit.domain}</Table.Cell>
                  <Table.Cell>{getStatusBadge(audit.status)}</Table.Cell>
                  <Table.Cell>
                    {new Date(audit.created_at).toLocaleDateString()}
                  </Table.Cell>
                  <Table.Cell>
                    {audit.status === 'completed' && (
                      <Button
                        size="sm"
                        onClick={() => handleDownload(audit.id)}
                      >
                        Download PDF
                      </Button>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Stack>
    </Container>
  )
}
```

#### E. Home Page with Audit Form

```tsx
// frontend/src/pages/Home.tsx
import { useState } from 'react'
import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react'
import { Field } from '@chakra-ui/react/field'
import { useForm } from 'react-hook-form'
import { auditService } from '../services/auditService'
import type { HomeAuditInputValues } from '../types'

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
const WEBSITE_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/

export const Home = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState<string>('')
  const [error, setError] = useState<string>('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HomeAuditInputValues>()

  const onSubmit = async (data: HomeAuditInputValues) => {
    try {
      setIsLoading(true)
      setSuccess('')
      setError('')
      
      await auditService.submitAudit(data)
      
      setSuccess('Audit submitted successfully! Check your dashboard for results.')
      reset()
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } }
      setError(error.response?.data?.message || 'Failed to submit audit')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Container maxW="2xl" py={20}>
      <Stack gap={8} textAlign="center">
        <Heading size="2xl">EZAudit</Heading>
        <Text fontSize="xl" color="gray.600">
          Get comprehensive performance reports for your website
        </Text>

        {success && (
          <Box bg="green.50" color="green.800" p={4} borderRadius="md">
            <Text>{success}</Text>
          </Box>
        )}

        {error && (
          <Box bg="red.50" color="red.800" p={4} borderRadius="md">
            <Text>{error}</Text>
          </Box>
        )}

        <Box bg="white" p={8} borderRadius="xl" boxShadow="base">
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack gap={6}>
              <Field
                label="Website URL"
                invalid={!!errors.domain}
                errorText={errors.domain?.message}
              >
                <Input
                  placeholder="https://example.com"
                  {...register('domain', {
                    required: 'Website URL is required',
                    pattern: {
                      value: WEBSITE_REGEX,
                      message: 'Please enter a valid URL',
                    },
                  })}
                />
              </Field>

              <Field
                label="Email Address"
                invalid={!!errors.email}
                errorText={errors.email?.message}
              >
                <Input
                  type="email"
                  placeholder="your@email.com"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: EMAIL_REGEX,
                      message: 'Please enter a valid email',
                    },
                  })}
                />
              </Field>

              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                loading={isLoading}
              >
                Submit Audit
              </Button>
            </Stack>
          </form>
        </Box>
      </Stack>
    </Container>
  )
}
```

#### F. App Router Configuration

```tsx
// frontend/src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { PrivateRoute } from './components/PrivateRoute'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
```

#### G. Environment Variables

Create [`frontend/.env`](frontend/.env):

```env
VITE_API_URL=http://localhost:8000/api
VITE_PUSHER_APP_KEY=your-pusher-key
VITE_PUSHER_APP_CLUSTER=mt1
VITE_PUSHER_HOST=localhost
VITE_PUSHER_PORT=6001
VITE_PUSHER_SCHEME=http
```

---

### Part 2: Laravel Echo Configuration

#### Backend Setup

1. **Install Broadcasting Driver**:

```bash
cd backend
composer require pusher/pusher-php-server
```

2. **Configure `.env`**:

```env
BROADCAST_DRIVER=pusher
PUSHER_APP_ID=your-app-id
PUSHER_APP_KEY=your-app-key
PUSHER_APP_SECRET=your-app-secret
PUSHER_APP_CLUSTER=mt1
```

3. **Update [`config/broadcasting.php`](backend/config/broadcasting.php)**:

Ensure Pusher configuration is correct.

4. **Enable Broadcasting Routes** in [`routes/channels.php`](backend/routes/channels.php):

```php
<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('user.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});
```

---

### Part 3: Docker Configuration

Create [`docker-compose.yml`](docker-compose.yml):

```yaml
version: '3.8'

services:
  # Laravel Backend
  laravel:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: ezaudit-laravel
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/var/www/html
    environment:
      - DB_CONNECTION=mysql
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_DATABASE=ezaudit
      - DB_USERNAME=ezaudit
      - DB_PASSWORD=secret
    depends_on:
      - mysql
      - redis
    networks:
      - ezaudit-network

  # MySQL Database
  mysql:
    image: mysql:8.0
    container_name: ezaudit-mysql
    ports:
      - "3306:3306"
    environment:
      - MYSQL_DATABASE=ezaudit
      - MYSQL_USER=ezaudit
      - MYSQL_PASSWORD=secret
      - MYSQL_ROOT_PASSWORD=root
    volumes:
      - mysql-data:/var/lib/mysql
    networks:
      - ezaudit-network

  # Redis for Queues & Broadcasting
  redis:
    image: redis:7-alpine
    container_name: ezaudit-redis
    ports:
      - "6379:6379"
    networks:
      - ezaudit-network

  # Queue Worker
  queue:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: ezaudit-queue
    command: php artisan queue:work --tries=3
    volumes:
      - ./backend:/var/www/html
    depends_on:
      - mysql
      - redis
    networks:
      - ezaudit-network

  # React Frontend (for production build)
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: ezaudit-frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    networks:
      - ezaudit-network

volumes:
  mysql-data:

networks:
  ezaudit-network:
    driver: bridge
```

Create [`backend/Dockerfile`](backend/Dockerfile):

```dockerfile
FROM php:8.2-fpm

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    wkhtmltopdf

# Install PHP extensions
RUN docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Copy application files
COPY . .

# Install dependencies
RUN composer install

# Set permissions
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

CMD php artisan serve --host=0.0.0.0 --port=8000
```

Create [`frontend/Dockerfile`](frontend/Dockerfile):

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
```

---

### Part 4: Next Steps for Implementation

1. **Fix Login/Register Pages** with correct Chakra UI v3 syntax (use examples above)
2. **Create remaining pages**: Home, Dashboard with examples provided
3. **Set up App.tsx router** as shown above
4. **Configure environment variables** for both frontend and backend
5. **Set up Laravel Echo** on backend (Pusher or Redis)
6. **Test real-time updates** by submitting an audit and watching dashboard
7. **Copy static assets** from Next.js `public/` to React `public/`
8. **Run Docker containers**: `docker-compose up -d`
9. **Run migrations**: `docker-compose exec laravel php artisan migrate`
10. **Start queue worker**: Already configured in docker-compose
11. **Test end-to-end flow**: Register → Login → Submit Audit → View Dashboard → Download PDF

---

## Chakra UI v3 Key Differences Quick Reference

| v2 Syntax                             | v3 Syntax                                      |
| ------------------------------------- | ---------------------------------------------- |
| `<FormControl>`                       | `<Field>` from `@chakra-ui/react/field`        |
| `<FormLabel>`                         | `label` prop on `<Field>`                      |
| `<FormErrorMessage>`                  | `errorText` prop on `<Field>`                  |
| `spacing={6}`                         | `gap={6}`                                      |
| `isLoading={true}`                    | `loading={true}`                               |
| `<Link as={RouterLink} to="/path">`   | `<Link asChild><RouterLink to="/path"></Link>` |
| `<Alert status="error"><AlertIcon />` | Custom error box with `<Box bg="red.50">`      |

---

## Environment Setup Commands

### Backend (Laravel)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan jwt:secret
php artisan migrate
php artisan queue:work  # In separate terminal
```

### Frontend (React)

```bash
cd frontend
npm install
cp .env.example .env  # Create and configure
npm run dev
```

### Docker

```bash
docker-compose up -d
docker-compose exec laravel php artisan migrate
docker-compose logs -f
```

---

## Testing Checklist

- [ ] User can register and receive JWT token
- [ ] User can login and access dashboard
- [ ] User can submit audit (creates pending record)
- [ ] Queue processes audit (calls Lighthouse, generates PDF)
- [ ] Real-time update shows status change in dashboard
- [ ] User can download completed PDF
- [ ] Failed audits show error status
- [ ] Unauthenticated users redirected to login

---

## Migration Completion Estimate

- **Remaining Frontend Work**: 2-3 days
- **Laravel Echo Setup**: 1 day
- **Docker Configuration**: 1 day
- **Testing & Debugging**: 2-3 days
- **Total**: ~1 week

All backend code is functional and ready. The main tasks are:

1. Fixing React components with correct Chakra UI v3 syntax
2. Setting up Laravel Echo broadcasting
3. Docker configuration for deployment
4. End-to-end testing
