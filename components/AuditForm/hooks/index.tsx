import { useCallback, useEffect, useState } from 'react'
import { SubmitHandler, UseFormSetValue, UseFormTrigger } from 'react-hook-form'

import { useLoading } from '../../Loading'
import { ApiResponse, HomeAuditInputValues } from '../../../models'

const useInput = (
  setFormFieldValue: UseFormSetValue<HomeAuditInputValues>,
  onAlertClose: () => void,
  trigger: UseFormTrigger<HomeAuditInputValues>
) => {
  const [apiResponseOutput, setApiResponseOutput] =
    useState<ApiResponse | null>(null)
  const { isLoading, setIsLoading } = useLoading()

  useEffect(() => {
    trigger()
  }, [trigger])

  useEffect(() => {
    if (apiResponseOutput !== null) setApiResponseOutput(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAlertClose])

  const onSubmit: SubmitHandler<HomeAuditInputValues> = useCallback(
    async ({ domain, email }) => {
      try {
        setIsLoading(true)
        await fetch('/api/audit')
      } catch (e) {
        setIsLoading(false)
      } finally {
        setIsLoading(false)
        setFormFieldValue('domain', '')
        setFormFieldValue('email', '')
        trigger()
      }
    },
    [setFormFieldValue, setIsLoading, trigger]
  )

  return { isLoading, onSubmit, apiResponseOutput }
}

export { useInput }
