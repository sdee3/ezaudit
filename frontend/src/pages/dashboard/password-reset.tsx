import { Container, Stack } from '@chakra-ui/react'
import { Fragment, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useAuth } from '../../components'
import { ResetPasswordForm } from '../../components/Auth/components'
import { Head } from '../../head'
import { useApi } from '../../utils'

const PasswordResetPage = () => {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { fetchEmailDataFromUrl, parsedEmail } = useApi()
  const emailToken = searchParams.get('e')

  useEffect(() => {
    if (!emailToken) return

    fetchEmailDataFromUrl(emailToken, true)
  }, [fetchEmailDataFromUrl, parsedEmail, emailToken])

  return (
    <Fragment>
      <Head title="Password Reset | EZ Audit" />
      <Container maxW="container.xl">
        <Stack spacing={8} mx="auto" maxW="lg" py={12} px={6}>
          <ResetPasswordForm email={parsedEmail ?? user?.email} showFormOnly />
        </Stack>
      </Container>
    </Fragment>
  )
}

export default PasswordResetPage
