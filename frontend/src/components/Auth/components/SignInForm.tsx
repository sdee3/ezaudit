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
import { useCallback, useEffect, useMemo } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Alert } from '../../Alert'
import { SignInInputValues } from '../../../models'
import { EMAIL_REGEX_PATTERN, ROUTES } from '../../../utils'
import useAlert from '../../Alert/hooks'

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

  const isSubmitDisabled = useMemo(
    () => !!errors?.email || !!errors?.password || !isValid,
    [errors?.email, errors?.password, isValid]
  )

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

  const onSubmit: SubmitHandler<SignInInputValues> = useCallback(async () => {
    // Presentational in this wave: the password is not stored and no API is called.
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
          <form onSubmit={() => handleSubmit(onSubmit)}>
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
                  isDisabled={isSubmitDisabled}
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
