import { Button, Container, Heading, Text } from '@chakra-ui/react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

import { isAuthQueryError } from '../../utils'
import { AuthRecoveryFallback } from '../AuthRecoveryFallback'

interface Props {
  children: ReactNode
  /** Heading shown on the generic fallback card. */
  title?: string
}

interface State {
  error: Error | null
}

/**
 * Top-level error boundary. Convex "Not authenticated" errors get the
 * recovery sign-out flow instead of a broken screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally silent: no telemetry yet.
  }

  render() {
    const { error } = this.state
    const { children, title = 'Something went wrong' } = this.props

    if (!error) return children

    if (isAuthQueryError(error)) {
      return <AuthRecoveryFallback />
    }

    return (
      <Container maxW="container.sm" py={16}>
        <Heading size="md" mb={4}>
          {title}
        </Heading>
        <Text mb={6} color="gray.600">
          {error.message || 'An unexpected error occurred.'}
        </Text>
        <Button onClick={() => this.setState({ error: null })}>
          Try again
        </Button>
      </Container>
    )
  }
}
