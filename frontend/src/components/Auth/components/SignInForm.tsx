import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  useColorModeValue,
} from '@chakra-ui/react'
import { useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Alert } from '../../Alert'
import { SignInInputValues } from '../../../models'
import { EMAIL_REGEX_PATTERN, ROUTES } from '../../../utils'
import useAlert from '../../Alert/hooks'
import { buildIdentitySignInUrl } from '../../../lib/identity'

interface Props {
  isNewlyRegistered: boolean
}

export const SignInForm = ({ isNewlyRegistered }: Props) => {
  const {
    register,
    handleSubmit,
    formState: { isValid, errors },
  } = useForm<SignInInputValues>({
    mode: 'onChange',
    defaultValues: { email: '', password: '' },
  })
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { alertMessage, setAlertMessage, onAlertClose } = useAlert()

  useEffect(() => {
    // query.pc indicates that a 'P'assword had just been 'C'hanged.
    if (searchParams.get('pc')) {
      setAlertMessage({
        message: 'Your password has been changed. Proceed to sign in.',
        state: 'success',
      })

      navigate(ROUTES.dashboard, { replace: true })

      return
    }

    if (!isNewlyRegistered) return

    setAlertMessage({
      message: 'You have successfully registered. Proceed to sign in.',
      state: 'success',
    })
  }, [isNewlyRegistered, setAlertMessage, searchParams, navigate])

  const continueWithIdentity = useCallback(() => {
    // SDEE3 Identity owns credentials: the hub mints the session and returns to
    // /sso-callback with a sign-in token (docs/specs/03-identity-auth.md).
    window.location.assign(buildIdentitySignInUrl(window.location.origin))
  }, [])

  const { message, state } = alertMessage

  return (
    <Flex align="center" justify="center" flexDirection="column">
      {message?.length > 0 && state && (
        <Alert
          alertMessage={message}
          onCloseCallback={onAlertClose}
          status={state}
          mx="auto"
          maxW="lg"
        />
      )}
      <Stack spacing={8} mx="auto" maxW="lg" py={12} px={6}>
        <Stack align="center" mb={6}>
          <Heading fontSize="4xl">Sign in to your account</Heading>
        </Stack>
        <Box
          rounded="lg"
          bg={useColorModeValue('white', 'gray.700')}
          boxShadow="lg"
          p={8}
        >
          <form onSubmit={() => handleSubmit(continueWithIdentity)}>
            <Stack spacing={4}>
              <FormControl id="email">
                <FormLabel>Email address</FormLabel>
                <Input
                  type="email"
                  {...register('email', {
                    required: true,
                    pattern: EMAIL_REGEX_PATTERN,
                  })}
                  isInvalid={!!errors?.email}
                />
              </FormControl>
              <FormControl id="password">
                <FormLabel>Password</FormLabel>
                <Input
                  type="password"
                  {...register('password', {
                    required: true,
                  })}
                  isInvalid={!!errors?.password}
                />
              </FormControl>
              <Stack spacing={10}>
                <Button
                  bg="blue.400"
                  color="white"
                  _hover={{
                    bg: 'blue.500',
                  }}
                  onClick={continueWithIdentity}
                >
                  Continue with SDEE3 Identity
                </Button>
              </Stack>
            </Stack>
          </form>
        </Box>
      </Stack>
    </Flex>
  )
}
