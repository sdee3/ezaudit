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
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'

import { Alert } from '../../Alert'
import { RegisterInputValues } from '../../../models'
import { EMAIL_REGEX_PATTERN } from '../../../utils'
import useAlert from '../../Alert/hooks'
import { buildIdentitySignUpUrl } from '../../../lib/identity'

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
  const { alertMessage, setAlertMessage, onAlertClose } = useAlert()

  const passwordWatchers = watch(['password', 'password_confirmation'])

  const continueWithIdentity = useCallback(() => {
    // SDEE3 Identity owns registration: delegate to the hub sign-up
    // (docs/specs/03-identity-auth.md).
    window.location.assign(buildIdentitySignUpUrl(window.location.origin))
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
          <Heading fontSize="4xl">Register your account</Heading>
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
                  errorBorderColor="red.500"
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
                  onClick={continueWithIdentity}
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
