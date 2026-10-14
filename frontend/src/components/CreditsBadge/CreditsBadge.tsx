import { useAuth } from '@clerk/react'
import { Flex, Text, Tooltip } from '@chakra-ui/react'
import { BiCoin } from 'react-icons/bi'

import {
  IdentityCreditsProvider,
  useCreditsBalance,
} from '../../lib/identityCredits'

/**
 * Shared SDEE3 credit balance (identity.sdee3.com) shown for signed-in users.
 * Renders nothing signed-out or when VITE_IDENTITY_CONVEX_URL is missing.
 */
function BalancePill() {
  const { balance } = useCreditsBalance()

  return (
    <Tooltip label="SDEE3 credits — shared balance across all SDEE3 apps" placement="bottom">
      <Flex
        alignItems="center"
        gap="2"
        px="3"
        py="1.5"
        borderRadius="full"
        bg="gray.100"
        color="gray.700"
        cursor="default"
      >
        <BiCoin />
        <Text fontSize="sm" fontWeight="medium">
          {balance === undefined ? '—' : Math.round(balance).toLocaleString('en-US')}{' '}
          credits
        </Text>
      </Flex>
    </Tooltip>
  )
}

export function CreditsBadge() {
  const { isSignedIn } = useAuth()
  if (!isSignedIn) {
    return null
  }

  return (
    <IdentityCreditsProvider>
      <BalancePill />
    </IdentityCreditsProvider>
  )
}
