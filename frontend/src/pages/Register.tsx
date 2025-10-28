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
      const errorObj = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
      const errorMsg = errorObj.response?.data?.message || 'Registration failed'
      const validationErrors = errorObj.response?.data?.errors
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
              <Box>
                <Text mb={2} fontWeight="semibold">Name</Text>
                <Input
                  {...register('name', {
                    required: 'Name is required',
                  })}
                />
                {errors.name && <Text color="red.500" fontSize="sm" mt={1}>{errors.name.message}</Text>}
              </Box>

              <Box>
                <Text mb={2} fontWeight="semibold">Email</Text>
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
                {errors.email && <Text color="red.500" fontSize="sm" mt={1}>{errors.email.message}</Text>}
              </Box>

              <Box>
                <Text mb={2} fontWeight="semibold">Password</Text>
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
                {errors.password && <Text color="red.500" fontSize="sm" mt={1}>{errors.password.message}</Text>}
              </Box>

              <Box>
                <Text mb={2} fontWeight="semibold">Confirm Password</Text>
                <Input
                  type="password"
                  {...register('password_confirmation', {
                    required: 'Please confirm your password',
                    validate: (value) =>
                      value === password || 'Passwords do not match',
                  })}
                />
                {errors.password_confirmation && <Text color="red.500" fontSize="sm" mt={1}>{errors.password_confirmation.message}</Text>}
              </Box>

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