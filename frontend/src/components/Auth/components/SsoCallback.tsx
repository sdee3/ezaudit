import { Flex, Button, Spinner, Text } from '@chakra-ui/react'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  consumeSignInRedirectPath,
  openIdentitySignIn,
  readSignInTicket,
  useSignInTokenHandoff,
} from '../../../lib/identity'
import { ROUTES } from '../../../utils'

/**
 * Consumes the SDEE3 Identity sign-in ticket (?token= / ?__clerk_ticket=),
 * activates the Clerk session, and continues to the remembered deep link
 * (default: dashboard). Expired/invalid tickets get an explicit error with
 * a retry path instead of a silent bounce.
 */
export const SsoCallback = () => {
  const navigate = useNavigate()
  const ticket = readSignInTicket()

  const onSuccess = useCallback(() => {
    navigate(consumeSignInRedirectPath() ?? ROUTES.dashboard, {
      replace: true,
    })
  }, [navigate])
  const handoff = useSignInTokenHandoff({ onSuccess })

  if (!ticket) {
    return (
      <Flex align="center" justify="center" p={6}>
        <Text maxW="md" textAlign="center" color="red.500" role="alert">
          Missing sign-in token. Return to the app and try again.
        </Text>
      </Flex>
    )
  }

  if (handoff === 'error') {
    return (
      <Flex align="center" justify="center" flexDirection="column" gap={4} p={6}>
        <Text maxW="md" textAlign="center" color="red.500" role="alert">
          Sign-in link expired or invalid.
        </Text>
        <Button onClick={() => openIdentitySignIn()}>Try again</Button>
      </Flex>
    )
  }

  return (
    <Flex align="center" justify="center" flexDirection="column" gap={3} py={20}>
      <Spinner aria-label="Finishing sign-in" />
      <Text color="gray.500">Finishing sign-in…</Text>
    </Flex>
  )
}
