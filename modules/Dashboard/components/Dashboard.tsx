import { useCallback, useEffect } from 'react'
import { Box, Button, Container, Heading, Text } from '@chakra-ui/react'
import { useRouter } from 'next/router'

import { AuthWrapper, useAuth } from '../../../components'
import { ROUTES, SUCCESS_STATUS_CODE, useApi } from '../../../utils'
import { User } from '../../../models'

interface Props {
  user: User | null
}

export const Dashboard = ({ user }: Props) => {
  const { user: userFromContext, clearUser } = useAuth()
  const { push, reload } = useRouter()
  const { fetchFromApi } = useApi()

  const logout = useCallback(async () => {
    const res = await fetchFromApi('/api/auth/logout', 'POST')

    if (res.status === SUCCESS_STATUS_CODE) {
      clearUser()
      reload()
    }
  }, [clearUser, fetchFromApi, reload])

  useEffect(() => {
    if (!userFromContext) return
    if (!!userFromContext && !user) reload()
  }, [userFromContext, user, reload])

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
          <Button
            data-cy="viewAuditsBtn"
            onClick={() => push(ROUTES.userAudits)}
          >
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
            <Button
              data-cy="changePasswordBtn"
              onClick={() => push(ROUTES.passwordReset)}
            >
              Change Password
            </Button>
            <Button data-cy="signOutBtn" onClick={() => logout()}>
              Sign Out
            </Button>
          </Box>
        </Box>
      </Box>
    </Container>
  )
}
