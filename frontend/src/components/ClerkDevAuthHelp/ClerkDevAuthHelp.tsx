import { Box, Text } from '@chakra-ui/react'
import { useSyncExternalStore } from 'react'

import { usesDirectClerkSignIn } from '../../lib/identity'

const CLERK_ATTACK_PROTECTION_URL =
  'https://dashboard.clerk.com/last-active?path=attack-protection'

function subscribeToHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

function getHash() {
  return window.location.hash
}

/** Dev-only guidance for Clerk Client Trust on localhost password sign-in. */
export default function ClerkDevAuthHelp() {
  const hash = useSyncExternalStore(subscribeToHash, getHash, () => '')
  const onClientTrust = hash.includes('client-trust')

  if (!import.meta.env.DEV || !usesDirectClerkSignIn()) {
    return null
  }

  if (onClientTrust) {
    return (
      <Box
        mb={4}
        w="100%"
        maxW="md"
        borderWidth={1}
        borderColor="orange.300"
        bg="orange.50"
        px={4}
        py={3}
        fontSize="sm"
        color="orange.900"
        role="status"
      >
        <Text fontWeight="semibold">Local dev: new-device verification</Text>
        <Text mt={1} lineHeight="1.6">
          Password sign-in on localhost triggers Clerk <strong>Client Trust</strong>.
          Dev emails are sent from <code>@accounts.dev</code> — check spam. The
          test code<code>424242</code> only works for <code>+clerk_test</code>{' '}
          addresses, not real inboxes.
        </Text>
        <ul>
          <li>
            <Text
              as="a"
              href="/sign-in"
              fontWeight="medium"
              textDecoration="underline"
              onClick={event => {
                event.preventDefault()
                window.location.assign('/sign-in')
              }}
            >
              Start over
            </Text>{' '}
            and use <strong>Continue with Google</strong> (skips Client Trust).
          </li>
          <li>
            Or disable Client Trust on your dev Clerk instance:{' '}
            <Text
              as="a"
              href={CLERK_ATTACK_PROTECTION_URL}
              fontWeight="medium"
              textDecoration="underline"
              target="_blank"
            >
              Dashboard → Attack protection
            </Text>
            .
          </li>
        </ul>
      </Box>
    )
  }

  return (
    <Box
      mb={4}
      w="100%"
      maxW="md"
      bg="blue.50"
      px={4}
      py={3}
      fontSize="sm"
      color="gray.700"
      role="note"
    >
      <Text fontWeight="medium">Local dev sign-in</Text>
      <Text mt={1} lineHeight="1.6">
        Prefer <strong>Continue with Google</strong> on localhost. Password
        sign-in may require a Client Trust email code from{' '}
        <code>@accounts.dev</code>.
      </Text>
    </Box>
  )
}
