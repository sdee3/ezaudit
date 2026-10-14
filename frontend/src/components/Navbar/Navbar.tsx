import { Box, Container, Flex, Heading, theme } from '@chakra-ui/react'
import { BiUserCircle } from 'react-icons/bi'
import { useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ROUTES } from '../../utils'
import { PrintContext } from '../../modules/Print'

export const Navbar = () => {
  const navigate = useNavigate()
  const { isPrinting } = useContext(PrintContext)

  return (
    <nav>
      <Container py="4" mb="10" shadow="md" maxW="100vw">
        <Box mx="2">
          <Flex alignItems="center" justifyContent="space-between">
            <Link to={ROUTES.home}>
              <Flex alignItems="center" gap="4">
                <Box boxSize="50px">
                  <img
                    src="/static/manifest/icon-192x192.png"
                    alt="EZ Audit logo"
                    width="100%"
                    height="100%"
                  />
                </Box>
                <Heading fontSize="2xl" textColor="gray.800">
                  EZ Audit
                </Heading>
              </Flex>
            </Link>
            <BiUserCircle
              cursor="pointer"
              color={theme.colors.gray[600]}
              visibility={isPrinting ? 'hidden' : 'visible'}
              onClick={() => navigate(ROUTES.dashboard)}
              size="3rem"
              title="User dashboard"
            />
          </Flex>
        </Box>
      </Container>
    </nav>
  )
}
