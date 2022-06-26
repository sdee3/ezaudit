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
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { useRouter } from 'next/router'

import { Alert } from '../../Alert'
import { SignInInputValues } from '../../../models'
import {
  EMAIL_REGEX_PATTERN,
  ROUTES,
  UNAUTHORIZED_STATUS_CODE,
  useApi,
} from '../../../utils'
import useAlert from '../../Alert/hooks'
import { AuthContext } from '..'

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
  const router = useRouter()
  const { setUserData } = useContext(AuthContext)
  const { fetchFromApi } = useApi()
  const [isLoading, setIsLoading] = useState(false)
  const { alertMessage, setAlertMessage, onAlertClose } = useAlert()

  const isSubmitDisabled = useMemo(
    () => !!errors?.email || !!errors?.password || !isValid,
    [errors?.email, errors?.password, isValid]
  )

  useEffect(() => {
    // query.pc indicates that a 'P'assword had just been 'C'hanged.
    if (router?.query?.pc) {
      setAlertMessage({
        message: 'Your password has been changed. Proceed to sign in.',
        state: 'success',
      })

      router?.replace({ pathname: ROUTES.dashboard, query: undefined })

      return
    }

    if (!isNewlyRegistered) return

    setAlertMessage({
      message: 'You have successfully registered. Proceed to sign in.',
      state: 'success',
    })
  }, [isNewlyRegistered, setAlertMessage, router])

  const onSubmit: SubmitHandler<SignInInputValues> = useCallback(
    async ({ email, password }) => {
      try {
        setIsLoading(true)
        alertMessage.message.length && onAlertClose()

        const response = await fetchFromApi('/api/auth/login', 'POST', {
          email,
          password,
        })

        if (response.status === UNAUTHORIZED_STATUS_CODE) {
          setAlertMessage({
            message: 'The data you entered is incorrect. Please try again.',
            state: 'error',
          })

          return
        }

        const { user, access_token } = response
        setUserData(user as object, access_token as string)
      } catch (error) {
        setIsLoading(false)
      } finally {
        setIsLoading(false)
      }
    },
    [
      alertMessage.message.length,
      fetchFromApi,
      onAlertClose,
      setAlertMessage,
      setUserData,
    ]
  )

  const { message, state } = alertMessage

  return (
    <Flex align="center" justify="center" flexDirection="column">
      {message?.length > 0 && (
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
          <form data-cy="signInForm" onSubmit={() => handleSubmit(onSubmit)}>
            <Stack spacing={4}>
              <FormControl id="email">
                <FormLabel>Email address</FormLabel>
                <Input
                  data-cy="signInEmailInput"
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
                  data-cy="signInPasswordInput"
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
                  data-cy="signInSubmitButton"
                  disabled={isSubmitDisabled}
                  isLoading={isLoading}
                  onClick={handleSubmit(onSubmit)}
                >
                  Sign in
                </Button>
              </Stack>
            </Stack>
          </form>
        </Box>
      </Stack>
    </Flex>
  )
}
