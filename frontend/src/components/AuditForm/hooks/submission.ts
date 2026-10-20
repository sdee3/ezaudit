import { UseFormSetValue, UseFormTrigger } from 'react-hook-form'

import { ApiResponse, HomeAuditInputValues } from '../../../models'

const SUBMITTED_MESSAGE =
  "Audit submitted! We'll email the results when it's ready."

export const reportHref = (auditId: unknown, isSignedIn: boolean) =>
  isSignedIn && typeof auditId === 'string'
    ? `/dashboard/audits/${auditId}`
    : null

export const submitAuditForm = async (
  submitAudit: (values: HomeAuditInputValues) => Promise<unknown>,
  values: HomeAuditInputValues,
  setFormFieldValue: UseFormSetValue<HomeAuditInputValues>,
  setIsLoading: (value: boolean) => void,
  trigger: UseFormTrigger<HomeAuditInputValues>
): Promise<ApiResponse> => {
  setIsLoading(true)
  try {
    const auditId = String(await submitAudit(values))
    setFormFieldValue('domain', '')
    setFormFieldValue('email', '')
    return { status: 202, message: SUBMITTED_MESSAGE, auditId }
  } catch (error) {
    return {
      status: 500,
      message: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
    }
  } finally {
    setIsLoading(false)
    trigger()
  }
}
