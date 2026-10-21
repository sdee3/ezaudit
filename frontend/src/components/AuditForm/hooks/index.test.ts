import { describe, expect, it, vi } from 'vitest'

import { reportHref, submitAuditForm } from './submission'
import { HomeAuditInputValues } from '../../../models'

const values: HomeAuditInputValues = {
  domain: 'https://example.com',
  email: 'owner@example.com',
}

const createSetValue = () => vi.fn()

describe('submitAuditForm', () => {
  it('shows a report path only for a signed-in owner', () => {
    expect(reportHref('audit-123', true)).toBe('/dashboard/audits/audit-123')
    expect(reportHref('audit-123', false)).toBeNull()
    expect(reportHref('audit-123', false, 'secret token')).toBe(
      '/dashboard/audits/audit-123#guestToken=secret%20token'
    )
  })

  it('returns the guest token for the secure report link', async () => {
    const setValue = createSetValue()
    const mutation = vi.fn().mockResolvedValue({ auditId: 'audit-123', guestToken: 'guest-secret' })
    const result = await submitAuditForm(mutation, values, setValue, vi.fn(), vi.fn())

    expect(reportHref(result.auditId, false, result.guestToken)).toBe(
      '/dashboard/audits/audit-123#guestToken=guest-secret'
    )
  })

  it('clears the domain and returns the report id after a successful mutation', async () => {
    const setValue = createSetValue()
    const mutation = vi.fn().mockResolvedValue({ auditId: 'audit-123' })

    const result = await submitAuditForm(
      mutation,
      values,
      setValue,
      vi.fn(),
      vi.fn().mockResolvedValue(true)
    )

    expect(mutation).toHaveBeenCalledWith(values)
    expect(result).toMatchObject({ status: 202, auditId: 'audit-123' })
    expect(setValue).toHaveBeenCalledOnce()
    expect(setValue).toHaveBeenCalledWith('domain', '')
  })

  it('keeps fields after a failed mutation', async () => {
    const setValue = createSetValue()
    const mutation = vi.fn().mockRejectedValue(new Error('Service unavailable'))

    const result = await submitAuditForm(
      mutation,
      values,
      setValue,
      vi.fn(),
      vi.fn().mockResolvedValue(true)
    )

    expect(result).toMatchObject({ status: 500, message: 'Service unavailable' })
    expect(setValue).not.toHaveBeenCalled()
  })
})
