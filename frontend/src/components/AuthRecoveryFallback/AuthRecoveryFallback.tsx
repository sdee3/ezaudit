import { useAuth } from '@clerk/react'
import { Flex, Spinner, Text } from '@chakra-ui/react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { ROUTES } from '../../utils'

/**
 * When a query throws "Not authenticated" while Clerk still shows a session,
 * sign out locally and send the user to sign-in instead of leaving a broken UI.
 */
export function AuthRecoveryFallback() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) {
      return
    }
    startedRef.current = true

    void signOut()
      .catch(() => {
        // Session may already be cleared; still redirect.
      })
      .finally(() => {
        navigate(ROUTES.signIn, {
          replace: true,
        })
      })
  }, [navigate, signOut])

  return (
    <Flex align="center" justify="center" flexDirection="column" gap={3} py={20}>
      <Spinner size="md" aria-label="Session expired" />
      <Text fontSize="sm" color="gray.500">
        Your session expired. Redirecting to sign in…
      </Text>
    </Flex>
  )
}
