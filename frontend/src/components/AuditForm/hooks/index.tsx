import { useCallback, useEffect, useState } from 'react'
import { SubmitHandler, UseFormSetValue, UseFormTrigger } from 'react-hook-form'
import { useMutation, useQuery } from 'convex/react'

import { api } from 'convex/_generated/api'

import { useLoading } from '../../Loading'
import { ApiResponse, HomeAuditInputValues } from '../../../models'
import { submitAuditForm } from './submission'

export { existingAuditForDomain, reportHref } from './submission'

const useInput = (
  setFormFieldValue: UseFormSetValue<HomeAuditInputValues>,
  onAlertClose: () => void,
  trigger: UseFormTrigger<HomeAuditInputValues>,
  isSignedIn: boolean
) => {
  const [apiResponseOutput, setApiResponseOutput] =
    useState<ApiResponse | null>(null)
  const { isLoading, setIsLoading } = useLoading()
  const submitAudit = useMutation(api.audits.submit)
  const audits = useQuery(api.audits.listMine, isSignedIn ? {} : 'skip')

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

  return { audits, isLoading, onSubmit, apiResponseOutput }
}

export { useInput }
