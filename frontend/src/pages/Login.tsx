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
      const errorObj = err as { response?: { data?: { message?: string } } }
      setError(errorObj.response?.data?.message || 'Login failed. Please try again.')
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

        <Box
          py={8}
          px={10}
          bg="white"
          boxShadow="base"
          borderRadius="xl"
        >
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack gap={6}>
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
                  })}
                />
                {errors.password && <Text color="red.500" fontSize="sm" mt={1}>{errors.password.message}</Text>}
              </Box>

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