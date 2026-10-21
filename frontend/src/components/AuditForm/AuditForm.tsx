import {
  Input as InputField,
  Button,
  FormControl,
  FormLabel,
  Flex,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react'
import { useContext, useEffect, useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { Link as RouterLink, useNavigate } from 'react-router-dom'

import { Alert } from '../Alert'
import { WEBSITE_REGEX_PATTERN } from '../../utils'
import useAlert from '../Alert/hooks'
import { reportHref, useInput } from './hooks'
import { existingAuditForDomain } from './hooks/submission'
import { HomeAuditInputValues } from '../../models'
import { AuthContext } from '../Auth'
import { ROUTES } from '../../utils'

export const AuditForm = () => {
  const { user } = useContext(AuthContext)
  const navigate = useNavigate()
  const [existingAudit, setExistingAudit] = useState<{ _id: string; domain: string } | null>(null)
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

  useEffect(() => {
    if (user?.email) setValue('email', user.email)
  }, [setValue, user?.email])

  const { alertMessage, onAlertClose, setAlertMessage } = useAlert()
  const { audits, isLoading, onSubmit, apiResponseOutput } = useInput(
    setValue,
    onAlertClose,
    trigger,
    !!user
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
    ? reportHref(apiResponseOutput.auditId, !!user, apiResponseOutput.guestToken)
    : null
  const submitButton = (
    <Button
      flexShrink={0}
      isLoading={isLoading}
      type="submit"
      variant="outline"
      colorScheme="blue"
      isDisabled={!!errors?.domain || !!errors?.email || (!!user && audits === undefined)}
    >
      Submit
    </Button>
  )
  const handleFormSubmit = user
    ? handleSubmit(async values => {
        if (!audits) return
        const match = existingAuditForDomain(audits, values.domain)
        if (match) {
          setExistingAudit(match)
          return
        }
        await onSubmit(values)
      })
    : (event: FormEvent<HTMLFormElement>) => event.preventDefault()

  return (
    <>
      <form onSubmit={handleFormSubmit}>
        <FormControl id="auditForm">
          <FormLabel htmlFor="domain">Your website to audit</FormLabel>
          <Flex mb="4" gap={2}>
            <InputField
              id="domain"
              placeholder="Enter your domain here"
              variant="flushed"
              flex="1"
              minW={0}
              {...register('domain', {
                required: true,
                pattern: WEBSITE_REGEX_PATTERN,
              })}
            />
            {user && submitButton}
          </Flex>
          {!user && (
            <Text mt={2}>
              <Link as={RouterLink} to="/sign-in" color="blue.600">
                Sign in
              </Link>{' '}
              with a verified email to request an audit.
            </Text>
          )}
        </FormControl>
      </form>

      {reportLink && user && (
        <Text mt={4}>
          <Link color="blue.600" href={reportLink}>
            View your private audit report
          </Link>
        </Text>
      )}
      {reportLink && !user && (
        <Text mt={4}>
          <Link color="blue.600" href={reportLink}>
            View your secure private audit report
          </Link>
          <Text> Save this link. It expires 30 days after submission.</Text>
        </Text>
      )}

      <Modal isOpen={!!existingAudit} onClose={() => setExistingAudit(null)} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Existing audit found</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            Open the existing audit for {existingAudit?.domain}? The restart option will be highlighted when available.
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={() => setExistingAudit(null)}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={() => {
                if (!existingAudit) return
                navigate(`${ROUTES.audit(existingAudit._id)}?highlightRestart=1`)
              }}
            >
              Open audit
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

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
