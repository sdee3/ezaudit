import { useCallback, useEffect, useState } from 'react'
import { SubmitHandler, UseFormSetValue, UseFormTrigger } from 'react-hook-form'
import { useMutation } from 'convex/react'

import { api } from 'convex/_generated/api'

import { useLoading } from '../../Loading'
import { ApiResponse, HomeAuditInputValues } from '../../../models'
import { submitAuditForm } from './submission'

export { reportHref } from './submission'

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
      setApiResponseOutput(
        await submitAuditForm(
          submitAudit,
          { domain, email },
          setFormFieldValue,
          setIsLoading,
          trigger
        )
      )
    },
    [submitAudit, setFormFieldValue, setIsLoading, trigger]
  )

  return { isLoading, onSubmit, apiResponseOutput }
}

export { useInput }
