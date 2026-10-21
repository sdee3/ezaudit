import {
  Alert,
  AlertDescription,
  AlertIcon,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Select,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react'
import { useMutation } from 'convex/react'
import { FormEvent, useEffect, useState } from 'react'
import { api } from 'convex/_generated/api'

import { useAuth } from '../components/Auth'
import { Head } from '../head'

export default function FeedbackPage() {
  const { user } = useAuth()
  const submitFeedback = useMutation(api.feedback.submit)
  const [category, setCategory] = useState<'feedback' | 'child_safety'>('feedback')
  const [email, setEmail] = useState(user?.email ?? '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email)
  }, [email, user?.email])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSending(true)
    try {
      await submitFeedback({
        category,
        email: email.trim() || undefined,
        message,
      })
      setSent(true)
      setMessage('')
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Your message could not be sent.'
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Container maxW="container.md" py={{ base: 4, md: 10 }}>
      <Head title="Send feedback | EZ Audit" />
      <VStack align="stretch" spacing={6}>
        <div>
          <Heading size="lg" mb={2}>
            Send feedback
          </Heading>
          <Text color="gray.600">
            Send a question, product comment, or child safety concern to EZ Audit.
          </Text>
        </div>

        {sent ? (
          <Alert status="success" borderRadius="md">
            <AlertIcon />
            <AlertDescription>
              Your message was sent to EZ Audit. Thank you.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit}>
            <VStack align="stretch" spacing={5}>
              {error && (
                <Alert status="error" borderRadius="md">
                  <AlertIcon />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <FormControl isRequired>
                <FormLabel htmlFor="feedback-category">Message type</FormLabel>
                <Select
                  id="feedback-category"
                  value={category}
                  onChange={event => setCategory(event.target.value as typeof category)}
                >
                  <option value="feedback">Product feedback</option>
                  <option value="child_safety">Child safety concern</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel htmlFor="feedback-email">Email address</FormLabel>
                <Input
                  id="feedback-email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                />
                <Text fontSize="sm" color="gray.600" mt={1}>
                  Add an email address if you want a reply.
                </Text>
              </FormControl>
              <FormControl isRequired>
                <FormLabel htmlFor="feedback-message">Your message</FormLabel>
                <Textarea
                  id="feedback-message"
                  minLength={10}
                  maxLength={5000}
                  rows={7}
                  value={message}
                  onChange={event => setMessage(event.target.value)}
                  required
                />
              </FormControl>
              <Button
                type="submit"
                colorScheme="blue"
                alignSelf="flex-start"
                isLoading={isSending}
              >
                Send message
              </Button>
            </VStack>
          </form>
        )}
      </VStack>
    </Container>
  )
}
