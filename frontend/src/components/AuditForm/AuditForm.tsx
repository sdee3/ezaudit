import {
  Input as InputField,
  Button,
  FormControl,
  FormLabel,
  Flex,
  Link,
  Text,
} from '@chakra-ui/react'
import { useContext, useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { Alert } from '../Alert'
import { EMAIL_REGEX_PATTERN, WEBSITE_REGEX_PATTERN } from '../../utils'
import useAlert from '../Alert/hooks'
import { reportHref, useInput } from './hooks'
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
  const reportLink = apiResponseOutput?.auditId
    ? reportHref(apiResponseOutput.auditId, !!user)
    : null

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormControl id="auditForm">
          <FormLabel htmlFor="domain">Your website to audit</FormLabel>
          <Flex mb="4">
            <InputField
              id="domain"
              placeholder="Enter your domain here"
              variant="flushed"
              {...register('domain', {
                required: true,
                pattern: WEBSITE_REGEX_PATTERN,
              })}
            />
          </Flex>
          <Flex gap={2}>
            <FormLabel htmlFor="email" mb="0" alignSelf="center">Email address</FormLabel>
            <InputField
              id="email"
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
            >
              Submit
            </Button>
          </Flex>
        </FormControl>
      </form>

      {reportLink && user && (
        <Text mt={4}>
          <Link color="blue.600" href={reportLink}>
            View your private audit report
          </Link>
        </Text>
      )}
      {apiResponseOutput?.auditId && !user && (
        <Text mt={4}>This report is private and cannot open from a guest submission.</Text>
      )}

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
