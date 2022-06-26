import { Box } from '@chakra-ui/react'
import { useState } from 'react'

import {
  SignInForm,
  RegisterForm,
  ResetPasswordForm,
  SignInCTA,
  RegisterCTA,
  ForgotPasswordCTA,
} from './components'

export const AuthWrapper = () => {
  const [option, setOption] = useState<'login' | 'register' | 'password-reset'>(
    'login'
  )
  const [isNewlyRegistered, setIsNewlyRegistered] = useState(false)

  const switchToRegister = () => setOption('register')
  const switchToSignIn = (registered?: boolean) => {
    setOption('login')
    registered && setIsNewlyRegistered(true)
  }
  const switchToPasswordReset = () => setOption('password-reset')

  return (
    <Box mb={20}>
      {option === 'password-reset' && (
        <>
          <ResetPasswordForm />
          <RegisterCTA onClick={switchToRegister} />
          <SignInCTA onClick={() => switchToSignIn()} />
        </>
      )}
      {option === 'login' && (
        <>
          <SignInForm isNewlyRegistered={isNewlyRegistered} />

          {!isNewlyRegistered && (
            <RegisterCTA onClick={() => switchToRegister()} />
          )}
        </>
      )}
      {option === 'register' && (
        <>
          <RegisterForm
            switchToLoginAfterRegistering={() => switchToSignIn(true)}
          />

          <SignInCTA onClick={() => switchToSignIn()} />
        </>
      )}
      {option !== 'password-reset' && (
        <ForgotPasswordCTA onClick={() => switchToPasswordReset()} />
      )}
    </Box>
  )
}
