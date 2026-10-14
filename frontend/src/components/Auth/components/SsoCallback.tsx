import { Flex, Heading, Spinner } from '@chakra-ui/react'

import { useSignInTokenHandoff } from '../../../lib/identity'

/** Consumes the SDEE3 Identity sign-in ticket (?token=) and continues to the intended route. */
export const SsoCallback = () => {
  useSignInTokenHandoff()

  return (
    <Flex align="center" justify="center" flexDirection="column" py={12}>
      <Heading fontSize="4xl" mb={6}>
        Signing you in…
      </Heading>
      <Spinner />
    </Flex>
  )
}
