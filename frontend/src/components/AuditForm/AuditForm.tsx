import {
  Input as InputField,
  Button,
  FormControl,
  FormLabel,
  Flex,
} from '@chakra-ui/react'
import { useContext, useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { Alert } from '../Alert'
import { EMAIL_REGEX_PATTERN, WEBSITE_REGEX_PATTERN } from '../../utils'
import useAlert from '../Alert/hooks'
import { useInput } from './hooks'
import { HomeAuditInputValues } from '../../models'
import { AuthContext } from '../Auth'

export const AuditForm = () => {
  const { user } = useContext(AuthContext)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    trigger,
  } = useForm<HomeAuditInputValues>({
    mode: 'onChange',
    defaultValues: { domain: '', email: user?.email ?? '' },
  })
  const { alertMessage, onAlertClose, setAlertMessage } = useAlert()

  const { isLoading, onSubmit, apiResponseOutput } = useInput(
    setValue,
    onAlertClose,
    trigger
  )

  useEffect(() => {
    const responseMessage = apiResponseOutput?.message
    if (typeof responseMessage !== 'string' || responseMessage.length === 0) {
      return
    }

    setAlertMessage({
      message: responseMessage,
      state: apiResponseOutput?.status === 202 ? 'success' : 'error',
    })
  }, [apiResponseOutput, setAlertMessage])

  const { message, state } = alertMessage

  return (
    <>
      <form onSubmit={() => handleSubmit(onSubmit)}>
        <FormControl id="auditForm">
          <FormLabel>Your website to audit</FormLabel>
          <Flex mb="4">
            <InputField

              placeholder="Enter your domain here"
              variant="flushed"
              {...register('domain', {
                required: true,
                pattern: WEBSITE_REGEX_PATTERN,
              })}
            />
          </Flex>
          <Flex gap={2}>
            <InputField

              placeholder="Enter your e-mail"
              variant="flushed"
              {...register('email', {
                required: true,
                pattern: EMAIL_REGEX_PATTERN,
              })}
            />
            <Button

              isLoading={isLoading}
              type="submit"
              variant="outline"
              colorScheme="blue"
              isDisabled={!!errors?.domain || !!errors?.email}
              onClick={handleSubmit(onSubmit)}
            >
              Submit
            </Button>
          </Flex>
        </FormControl>
      </form>

      {message?.length > 0 && state && (
        <Alert
          marginTop={6}
          alertMessage={message}
          onCloseCallback={onAlertClose}
          status={state}
        />
      )}
    </>
  )
}
