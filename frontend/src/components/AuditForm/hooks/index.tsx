import { useCallback, useEffect, useState } from 'react'
import { SubmitHandler, UseFormSetValue, UseFormTrigger } from 'react-hook-form'
import { useMutation } from 'convex/react'

import { api } from 'convex/_generated/api'

import { useLoading } from '../../Loading'
import { ApiResponse, HomeAuditInputValues } from '../../../models'

const SUBMITTED_MESSAGE =
  "Audit submitted! We'll email the results when it's ready."

const useInput = (
  setFormFieldValue: UseFormSetValue<HomeAuditInputValues>,
  onAlertClose: () => void,
  trigger: UseFormTrigger<HomeAuditInputValues>
) => {
  const [apiResponseOutput, setApiResponseOutput] =
    useState<ApiResponse | null>(null)
  const { isLoading, setIsLoading } = useLoading()
  const submitAudit = useMutation(api.audits.submit)

  useEffect(() => {
    trigger()
  }, [trigger])

  useEffect(() => {
    if (apiResponseOutput !== null) setApiResponseOutput(null)
  }, [onAlertClose])

  const onSubmit: SubmitHandler<HomeAuditInputValues> = useCallback(
    async ({ domain, email }) => {
      try {
        setIsLoading(true)
        await submitAudit({ domain, email })

        setApiResponseOutput({ status: 202, message: SUBMITTED_MESSAGE })
      } catch (error) {
        setApiResponseOutput({
          status: 500,
          message:
            error instanceof Error
              ? error.message
              : 'Something went wrong. Please try again.',
        })
      } finally {
        setIsLoading(false)
        setFormFieldValue('domain', '')
        setFormFieldValue('email', '')
        trigger()
      }
    },
    [submitAudit, setFormFieldValue, setIsLoading, trigger]
  )

  return { isLoading, onSubmit, apiResponseOutput }
}

export { useInput }
