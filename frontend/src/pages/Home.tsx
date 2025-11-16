import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useForm } from 'react-hook-form'
import { auditService } from '../services/auditService'
import type { HomeAuditInputValues } from '../types'
import { useAuth } from '../contexts/AuthContext'

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
const WEBSITE_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/

export const Home = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
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
      const errorObj = err as { response?: { data?: { message?: string } } }
      setError(errorObj.response?.data?.message || 'Failed to submit audit')
    } finally {
      setIsLoading(false)
    }
  }

  if (isAuthenticated) {
    navigate('/dashboard')
    return null
  }

  return (
    <Container maxW="2xl" py={20}>
      <Stack gap={8} textAlign="center">
        <Heading size="2xl">EZAudit</Heading>
        <Text fontSize="xl" color="gray.600">
          Get comprehensive performance reports for your website using Google's Lighthouse
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
              <Box>
                <Text mb={2} fontWeight="semibold">Website URL</Text>
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
                {errors.domain && <Text color="red.500" fontSize="sm" mt={1}>{errors.domain.message}</Text>}
              </Box>

              <Box>
                <Text mb={2} fontWeight="semibold">Email Address</Text>
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
                {errors.email && <Text color="red.500" fontSize="sm" mt={1}>{errors.email.message}</Text>}
              </Box>

              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                loading={isLoading}
                width="full"
              >
                Submit Audit
              </Button>
            </Stack>
          </form>
        </Box>

        <Text color="gray.600">
          Already have an account?{' '}
          <Text as="span" color="blue.600" fontWeight="semibold" cursor="pointer" onClick={() => navigate('/login')}>
            Sign in
          </Text>
        </Text>
      </Stack>
    </Container>
  )
}