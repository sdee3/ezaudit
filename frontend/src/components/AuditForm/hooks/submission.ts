import { UseFormSetValue, UseFormTrigger } from 'react-hook-form'

import { ApiResponse, HomeAuditInputValues } from '../../../models'

const SUBMITTED_MESSAGE =
  "Audit submitted! We'll email the results when it's ready."

const auditHostname = (domain: string) => {
  try {
    return new URL(domain.includes('://') ? domain : `https://${domain}`)
      .hostname.toLowerCase()
      .replace(/^www\./, '')
  } catch {
    return domain.trim().toLowerCase()
  }
}

export const existingAuditForDomain = <T extends { _id: string; domain: string }>(
  audits: readonly T[],
  domain: string
): T | undefined => {
  const hostname = auditHostname(domain)
  return audits.find(audit => auditHostname(audit.domain) === hostname)
}

export const reportHref = (auditId: unknown, isSignedIn: boolean, guestToken?: unknown) => {
  if (typeof auditId !== 'string') return null
  if (isSignedIn) return `/dashboard/audits/${auditId}`
  return typeof guestToken === 'string'
    ? `/dashboard/audits/${auditId}#guestToken=${encodeURIComponent(guestToken)}`
    : null
}

export const submitAuditForm = async (
  submitAudit: (values: HomeAuditInputValues) => Promise<{ auditId: string; guestToken?: string }>,
  values: HomeAuditInputValues,
  setFormFieldValue: UseFormSetValue<HomeAuditInputValues>,
  setIsLoading: (value: boolean) => void,
  trigger: UseFormTrigger<HomeAuditInputValues>
): Promise<ApiResponse> => {
  setIsLoading(true)
  try {
    const { auditId, guestToken } = await submitAudit(values)
    setFormFieldValue('domain', '')
    return { status: 202, message: SUBMITTED_MESSAGE, auditId, guestToken }
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
