import { useCallback, useEffect } from 'react'
import { Box, Button, Container, Heading, Text } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'

import { AuthWrapper, useAuth } from '../../../components'
import { ROUTES } from '../../../utils'
import { User } from '../../../models'

interface Props {
  user: User | null
}

export const Dashboard = ({ user }: Props) => {
  const { user: userFromContext, clearUser } = useAuth()
  const navigate = useNavigate()

  const logout = useCallback(() => {
    clearUser()
  }, [clearUser])

  useEffect(() => {
    if (!userFromContext) return
    if (!!userFromContext && !user) window.location.reload()
  }, [userFromContext, user])

  if (!user && !userFromContext)
    return (
      <Container maxW="container.xl">
        <AuthWrapper />
      </Container>
    )

  return (
    <Container maxW="container.xl">
      <Heading mb="8">Dashboard</Heading>
      <hr />
      <Box minHeight="50vh">
        <Box mb={8}>
          <Text fontSize="3xl" fontWeight="bold" mb="4" mt="8">
            Your Data
          </Text>
          <Text>{JSON.stringify(user)}</Text>
        </Box>
        <hr />
        <Box mb={8}>
          <Text fontSize="3xl" fontWeight="bold" mb="4" mt="8">
            Audits
          </Text>
          <Button onClick={() => navigate(ROUTES.userAudits)}>
            View Your Audits
          </Button>
        </Box>
        <hr />
        <Box mb={8}>
          <Text fontSize="3xl" fontWeight="bold" mb="4" mt="8">
            Account Settings
          </Text>
          <Box
            display="flex"
            flexDirection="column"
            gap={4}
            width="fit-content"
          >
            <Button onClick={() => navigate(ROUTES.passwordReset)}>
              Change Password
            </Button>
            <Button onClick={() => logout()}>Sign Out</Button>
          </Box>
        </Box>
      </Box>
    </Container>
  )
}
