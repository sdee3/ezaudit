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
import { useCallback, useMemo, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'

import { Alert } from '../../Alert'
import { RegisterInputValues } from '../../../models'
import {
  CREATED_STATUS_CODE,
  EMAIL_REGEX_PATTERN,
  useApi,
} from '../../../utils'
import useAlert from '../../Alert/hooks'

interface Props {
  switchToLoginAfterRegistering: () => void
}

export const RegisterForm = ({ switchToLoginAfterRegistering }: Props) => {
  const {
    register,
    handleSubmit,
    formState: { isValid, errors },
    watch,
  } = useForm<RegisterInputValues>({
    mode: 'onChange',
    defaultValues: { email: '', password: '', password_confirmation: '' },
  })
  const { fetchFromApi } = useApi()
  const [isLoading, setIsLoading] = useState(false)
  const { alertMessage, setAlertMessage, onAlertClose } = useAlert()

  const isSubmitDisabled = useMemo(
    () =>
      !!errors?.email ||
      !!errors?.password ||
      !!errors?.password_confirmation ||
      !isValid,
    [errors?.email, errors?.password, errors?.password_confirmation, isValid]
  )

  const passwordWatchers = watch(['password', 'password_confirmation'])

  const onSubmit: SubmitHandler<RegisterInputValues> = useCallback(
    async ({ email, password, password_confirmation }) => {
      try {
        setIsLoading(true)
        alertMessage.message.length && onAlertClose()

        const response = await fetchFromApi('/api/auth/register', 'POST', {
          email,
          password,
          password_confirmation,
        })

        if (response.status !== CREATED_STATUS_CODE) {
          setAlertMessage({
            message:
              (response?.message as string) ??
              'The data you entered is incorrect. Please try again.',
            state: 'error',
          })

          return
        }

        switchToLoginAfterRegistering()
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
      switchToLoginAfterRegistering,
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
          <Heading fontSize="4xl">Register your account</Heading>
        </Stack>
        <Box
          rounded="lg"
          bg={useColorModeValue('white', 'gray.700')}
          boxShadow="lg"
          p={8}
        >
          <form data-cy="registerForm" onSubmit={() => handleSubmit(onSubmit)}>
            <Stack spacing={4}>
              <FormControl id="email">
                <FormLabel>Email address</FormLabel>
                <Input
                  data-cy="registerEmailInput"
                  type="email"
                  {...register('email', {
                    required: true,
                    pattern: EMAIL_REGEX_PATTERN,
                  })}
                  errorBorderColor="red.500"
                  isInvalid={!!errors?.email}
                />
              </FormControl>
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
                  Register
                </Button>
              </Stack>
            </Stack>
          </form>
        </Box>
      </Stack>
    </Flex>
  )
}
