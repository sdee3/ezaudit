import { SignIn, useAuth } from '@clerk/react'
import {
  Button,
  Container,
  Flex,
  Heading,
  Link,
  Spinner,
  Text,
} from '@chakra-ui/react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'

import {
  buildIdentitySignUpUrl,
  openIdentitySignIn,
  usesDirectClerkSignIn,
} from '../../lib/identity'
import { ClerkDevAuthHelp } from '../../components'
import { ROUTES } from '../../utils'
import { Head } from '../../head'

/**
 * The single sign-in surface. Production hands off to the SDEE3 Identity hub;
 * local dev can embed Clerk directly (VITE_CLERK_DIRECT_SIGN_IN=true).
 * Signed-out users landing here are redirected to the dashboard.
 */
const SignInPage = () => {
  const { isLoaded, isSignedIn } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isLoaded) {
    return (
      <Flex align="center" justify="center" py={40}>
        <Spinner aria-label="Loading" />
      </Flex>
    )
  }

  if (isSignedIn) {
    return <Navigate to={ROUTES.dashboard} replace />
  }

  if (usesDirectClerkSignIn()) {
    return (
      <Container maxW="container.md" py={16}>
        <ClerkDevAuthHelp />
        <SignIn routing="hash" fallbackRedirectUrl={ROUTES.dashboard} />
      </Container>
    )
  }

  const onContinue = () => {
    setError(null)
    setLoading(true)
    try {
      // SDEE3 Identity owns credentials: the hub mints the session and
      // returns to /sso-callback with a sign-in ticket.
      openIdentitySignIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open sign-in')
      setLoading(false)
    }
  }

  return (
    <Container maxW="container.md" py={16}>
      <Head title="Sign in | EZ Audit" />
      <Flex
        align="center"
        justify="center"
        flexDirection="column"
        gap={6}
        py={16}
      >
        <Heading fontSize="4xl">Sign in to EZ Audit</Heading>

        <Button
          size="lg"
          onClick={onContinue}
          disabled={loading}
          minWidth="240px"
        >
          {loading ? <Spinner size="sm" /> : 'Continue to sign in'}
        </Button>

        <Text maxW="sm" textAlign="center" color="gray.600" fontSize="sm">
          You will be redirected to SDEE3 Identity to sign in or create an
          account.
        </Text>

        <Text fontSize="sm" color="gray.500">
          New here?{' '}
          <Link
            href={buildIdentitySignUpUrl(window.location.origin)}
            color="blue.500"
          >
            Create an account
          </Link>
        </Text>

        {error && (
          <Text color="red.500" fontSize="sm" role="alert" maxW="sm" textAlign="center">
            {error}
          </Text>
        )}
      </Flex>
    </Container>
  )
}

export default SignInPage
