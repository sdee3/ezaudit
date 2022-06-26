import { Box, Flex, Link as UiLink, Text } from '@chakra-ui/react'
import Link from 'next/link'
import { useContext } from 'react'

import { PrintContext } from '../../modules/Print'
import { ROUTES } from '../../utils'

export const Footer = () => {
  const { isPrinting } = useContext(PrintContext)

  return (
    <footer>
      <Box mt={20} py={10}>
        <Flex
          alignItems="center"
          gap={4}
          justifyContent="center"
          direction="column"
        >
          <Text color="gray.600">
            Copyright &copy; {new Date().getFullYear()}, EZ Audit. All rights
            reserved.
          </Text>
          <UiLink as={Link} href={ROUTES.termsAndConditions}>
            <Text
              color="blue.600"
              display={isPrinting ? 'none' : 'block'}
              fontWeight="bold"
              cursor="pointer"
            >
              Terms and Conditions
            </Text>
          </UiLink>
        </Flex>
      </Box>
    </footer>
  )
}
