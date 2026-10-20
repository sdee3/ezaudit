import { useCallback } from 'react'
import { Box, Button, Container, Heading, Text } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'

import { RequireSignIn, useAuth } from '../../../components'
import { ROUTES } from '../../../utils'
import { User } from '../../../models'

interface Props {
  user: User | null
}

export const Dashboard = ({ user }: Props) => {
  const { clearUser } = useAuth()
  const navigate = useNavigate()

  const logout = useCallback(() => {
    clearUser()
  }, [clearUser])

  // The session guard holds authenticated mounting until Clerk/Convex agree,
  // so null here means genuinely signed out.
  if (!user) return <RequireSignIn />

  return (
    <Container maxW="container.xl">
      <Heading mb="8">Dashboard</Heading>
      <hr />
      <Box minHeight="50vh">
        <Box mb={8}>
          <Text fontSize="3xl" fontWeight="bold" mb="4" mt="8">
            Your Data
          </Text>
          <Text>
            <strong>Name:</strong> {user.name || 'Not provided'}
          </Text>
          <Text>
            <strong>Email:</strong> {user.email}
          </Text>
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
