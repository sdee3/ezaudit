import { Box, Flex, Link as UiLink, Text } from '@chakra-ui/react'
import { useContext } from 'react'
import { Link } from 'react-router-dom'

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
          <UiLink as={Link} to={ROUTES.termsAndConditions}>
            <Text
              color="blue.600"
              display={isPrinting ? 'none' : 'block'}
              className="print-hidden"
              fontWeight="bold"
              cursor="pointer"
            >
              Terms and Conditions
            </Text>
          </UiLink>
          <UiLink as={Link} to={ROUTES.feedback} className="print-hidden" display={isPrinting ? 'none' : 'block'}>
            <Text color="blue.600" fontWeight="bold" cursor="pointer">Send feedback</Text>
          </UiLink>
          <UiLink as={Link} to={ROUTES.childSafety} className="print-hidden" display={isPrinting ? 'none' : 'block'}>
            <Text color="blue.600" fontWeight="bold" cursor="pointer">Child safety standards</Text>
          </UiLink>
        </Flex>
      </Box>
    </footer>
  )
}
