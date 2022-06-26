import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useCallback, useContext, useMemo, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { useRouter } from 'next/router'

import { Alert } from '../../Alert'
import { ResetPasswordInputValues } from '../../../models'
import {
  EMAIL_REGEX_PATTERN,
  ERROR_CODES,
  ROUTES,
  SUCCESS_STATUS_CODE,
  UNAUTHORIZED_STATUS_CODE,
  useApi,
} from '../../../utils'
import useAlert from '../../Alert/hooks'
import { AuthContext } from '..'

interface Props {
  email?: string
  showFormOnly?: boolean
}

export const ResetPasswordForm = ({ email, showFormOnly = false }: Props) => {
  const {
    register,
    handleSubmit,
    formState: { isValid, errors },
    watch,
  } = useForm<ResetPasswordInputValues>({
    mode: 'onChange',
    defaultValues: {
      emailForReset: '',
      password: '',
      password_confirmation: '',
    },
  })
  const { fetchFromApi } = useApi()
  const { push } = useRouter()
  const { user, setUserData } = useContext(AuthContext)
  const [isLoading, setIsLoading] = useState(false)
  const { alertMessage, setAlertMessage, onAlertClose } = useAlert()

  const passwordWatchers = watch(['password', 'password_confirmation'])

  const isSubmitDisabled = useMemo(
    () => !!errors?.password || !!errors?.password_confirmation || !isValid,
    [errors?.password, errors?.password_confirmation, isValid]
  )

  const isSubmitPassResetDisabled = useMemo(
    () => !!errors?.emailForReset && !isValid,
    [errors?.emailForReset, isValid]
  )

  const onSubmit: SubmitHandler<ResetPasswordInputValues> = useCallback(
    async ({ emailForReset, password }) => {
      if (emailForReset && !password) {
        try {
          setIsLoading(true)
          alertMessage.message.length && onAlertClose()

          const response = await fetchFromApi(
            `/api/auth/reset-password/${emailForReset}`,
            'GET'
          )

          if (ERROR_CODES.includes(response.status)) {
            setAlertMessage({
              message:
                'An error occurred while trying to process your request. Please try again.',
              state: 'error',
            })
          }

          if (response.status === SUCCESS_STATUS_CODE) {
            setAlertMessage({
              message: 'An email with the password reset link is on its way!',
              state: 'success',
            })
          }
        } catch (error) {
          setIsLoading(false)
        } finally {
          setIsLoading(false)
        }

        return
      }

      try {
        setIsLoading(true)
        alertMessage.message.length && onAlertClose()

        const response = await fetchFromApi(
          '/api/auth/change-password',
          'POST',
          {
            email,
            password,
          }
        )

        if (response.status === UNAUTHORIZED_STATUS_CODE) {
          setAlertMessage({
            message: 'The data you entered is incorrect. Please try again.',
            state: 'error',
          })

          setIsLoading(false)
          return
        }

        const { user, access_token } = response

        if (!!user && !!access_token) {
          setUserData(user as object, access_token as string)
          setIsLoading(false)
          return
        }

        push({ pathname: ROUTES.dashboard, query: { pc: '1' } })
      } catch (error) {
        setIsLoading(false)
      } finally {
        setIsLoading(false)
      }
    },
    [
      alertMessage.message.length,
      email,
      fetchFromApi,
      onAlertClose,
      push,
      setAlertMessage,
      setUserData,
    ]
  )

  const { message, state } = alertMessage

  if (isLoading) return <Spinner />

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
      {!email && !user && (
        <Stack spacing={8} mx="auto" maxW="lg" py={12} px={6}>
          <Stack align="center" mb={6}>
            <Heading fontSize="4xl" mb={6}>
              Password Reset
            </Heading>
            <Text>
              To receive an email with a password reset link, please type in
              your email below.
            </Text>
          </Stack>
          <Box rounded="lg" boxShadow="lg" p={8}>
            <form
              data-cy="resetPasswordForm"
              onSubmit={() => handleSubmit(onSubmit)}
            >
              <Stack spacing={4}>
                <FormControl id="emailForReset">
                  <FormLabel>Email</FormLabel>
                  <Input
                    data-cy="resetPasswordEmailInput"
                    type="email"
                    {...register('emailForReset', {
                      required: true,
                      pattern: EMAIL_REGEX_PATTERN,
                    })}
                    isInvalid={!!errors?.emailForReset}
                  />
                </FormControl>

                <Stack spacing={10}>
                  <Button
                    bg="blue.400"
                    color="white"
                    _hover={{
                      bg: 'blue.500',
                    }}
                    disabled={isSubmitPassResetDisabled}
                    isLoading={isLoading}
                    onClick={handleSubmit(onSubmit)}
                  >
                    Submit
                  </Button>
                </Stack>
              </Stack>
            </form>
          </Box>
        </Stack>
      )}
      {email && (
        <Stack spacing={8} mx="auto" maxW="lg" py={12} px={6}>
          <Stack align="center" mb={6}>
            <Heading fontSize="4xl" mb={6}>
              Set your new password
            </Heading>
            {!showFormOnly && (
              <>
                <Text>Hello, {email}!</Text>
                <Text>
                  Before viewing your audit, please set your password.
                </Text>
              </>
            )}
          </Stack>
          <Box rounded="lg" boxShadow="lg" p={8}>
            {email && (
              <form onSubmit={() => handleSubmit(onSubmit)}>
                <Stack spacing={4}>
                  <FormControl id="password">
                    <FormLabel>Password</FormLabel>
                    <Input
                      data-cy="registerPasswordInput"
                      type="password"
                      {...register('password', {
                        required: true,
                      })}
                      isInvalid={!!errors?.password}
                    />
                  </FormControl>
                  <FormControl id="password_confirmation">
                    <FormLabel>Confirm your password</FormLabel>
                    <Input
                      data-cy="registerPasswordConfirmationInput"
                      type="password"
                      {...register('password_confirmation', {
                        required: true,
                      })}
                      isInvalid={
                        !!errors?.password_confirmation ||
                        (passwordWatchers[0] !== passwordWatchers[1] &&
                          passwordWatchers[1].length > 0)
                      }
                    />
                  </FormControl>
                  <Stack spacing={10}>
                    <Button
                      bg="blue.400"
                      color="white"
                      _hover={{
                        bg: 'blue.500',
                      }}
                      disabled={isSubmitDisabled}
                      isLoading={isLoading}
                      onClick={handleSubmit(onSubmit)}
                    >
                      Submit
                    </Button>
                  </Stack>
                </Stack>
              </form>
            )}
          </Box>
        </Stack>
      )}
    </Flex>
  )
}
