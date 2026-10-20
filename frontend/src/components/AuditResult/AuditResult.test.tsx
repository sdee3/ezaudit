import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { AuditResultParsed } from '../../models'
import { PrintContext } from '../../modules/Print'
import { AuthContext } from '../Auth'
import { AuditResult } from './AuditResult'

const audit = {
  _id: 'audit_id' as AuditResultParsed['_id'],
  _creationTime: 1,
  userId: 'owner_1',
  email: 'owner@example.com',
  domain: 'example.com',
  status: 'error',
  audit_result: null,
  is_public: false,
  date_of_request: 1,
  createdAt: 1,
  updatedAt: 1,
} satisfies AuditResultParsed

function renderAudit(user: { id: string } | null, retryEligible: boolean) {
  return renderToStaticMarkup(
    <AuthContext.Provider value={{ user: user as never, accessToken: null, setUserData: vi.fn(), clearUser: vi.fn() }}>
      <PrintContext.Provider value={{ isPrinting: false, setIsPrinting: vi.fn() }}>
        <AuditResult
          audit={audit}
          retryEligible={retryEligible}
          handleOnSwitchChange={vi.fn()}
          handleRetry={vi.fn()}
          handleDelete={vi.fn()}
        />
      </PrintContext.Provider>
    </AuthContext.Provider>,
  )
}

describe('audit owner actions', () => {
  it('shows retry only when the owner has a final failed audit', () => {
    const html = renderAudit({ id: 'owner_1' }, true)
    expect(html).toContain('Retry audit')
    expect(html).toContain('Delete audit')

    expect(renderAudit({ id: 'owner_1' }, false)).not.toContain('Retry audit')
  })

  it('hides owner actions from a shared report visitor', () => {
    const html = renderAudit(null, true)
    expect(html).not.toContain('Retry audit')
    expect(html).not.toContain('Delete audit')
  })
})
