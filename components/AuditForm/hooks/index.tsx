import { useCallback, useEffect, useState } from 'react'
import { SubmitHandler, UseFormSetValue, UseFormTrigger } from 'react-hook-form'

import { useApi } from '../../../utils'
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
  const { fetchFromApi } = useApi()

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
        const valueFromResponse: ApiResponse = await fetchFromApi(
          '/api/audit',
          'POST',
          { domain, email }
        )

        setApiResponseOutput(valueFromResponse)
      } catch {
        setIsLoading(false)
      } finally {
        setIsLoading(false)
        setFormFieldValue('domain', '')
        setFormFieldValue('email', '')
        trigger()
      }
    },
    [fetchFromApi, setFormFieldValue, setIsLoading, trigger]
  )

  return { isLoading, onSubmit, apiResponseOutput }
}

export { useInput }
