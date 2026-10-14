import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useCallback, useContext, useMemo } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'

import { Alert } from '../../Alert'
import { ResetPasswordInputValues } from '../../../models'
import { EMAIL_REGEX_PATTERN } from '../../../utils'
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
  const { user } = useContext(AuthContext)
  const { alertMessage, onAlertClose } = useAlert()

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
    async () => {
      // Presentational in this wave: the password is not stored and no API is called.
    },
    []
  )

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
            <form onSubmit={() => handleSubmit(onSubmit)}>
              <Stack spacing={4}>
                <FormControl id="emailForReset">
                  <FormLabel>Email</FormLabel>
                  <Input
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
                    isDisabled={isSubmitPassResetDisabled}
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
                      type="password"
                      {...register('password_confirmation', {
                        required: true,
                      })}
                      isInvalid={
                        !!errors?.password_confirmation ||
                        (passwordWatchers[0] !== passwordWatchers[1] &&
                          (passwordWatchers[1]?.length ?? 0) > 0)
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
                      isDisabled={isSubmitDisabled}
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
