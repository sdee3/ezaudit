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
  it('links to the audited website when the domain has no scheme', () => {
    expect(renderAudit(null, false)).toContain('href="https://example.com"')
  })

  it('shows restart only when the owner can restart an audit', () => {
    const html = renderAudit({ id: 'owner_1' }, true)
    expect(html).toContain('aria-label="Audit visibility and sharing"')
    expect(html).toContain('aria-label="Audit actions"')
    expect(html).toContain('Restart audit')
    expect(html).toContain('Delete audit')

    expect(renderAudit({ id: 'owner_1' }, false)).not.toContain('Restart audit')
  })

  it('hides owner actions from a shared report visitor', () => {
    const html = renderAudit(null, true)
    expect(html).not.toContain('Restart audit')
    expect(html).not.toContain('Delete audit')
  })

  it('shows Lighthouse findings and suggested fixes when present', () => {
    const html = renderToStaticMarkup(
      <AuthContext.Provider
        value={{
          user: { id: 'owner_1' } as never,
          accessToken: null,
          setUserData: vi.fn(),
          clearUser: vi.fn(),
        }}
      >
        <PrintContext.Provider value={{ isPrinting: false, setIsPrinting: vi.fn() }}>
          <AuditResult
            audit={{
              ...audit,
              findings: [
                {
                  id: 'image-alt',
                  category: 'accessibility',
                  title: 'Images need alt text',
                  description: 'Add alternative text to images.',
                  score: 0,
                  suggestedFixes: [
                    'Add alternative text to images.',
                    'Add descriptive alt text.',
                    'Add descriptive alt text.',
                  ],
                },
              ],
            }}
            retryEligible={false}
            handleOnSwitchChange={vi.fn()}
            handleRetry={vi.fn()}
            handleDelete={vi.fn()}
          />
        </PrintContext.Provider>
      </AuthContext.Provider>,
    )

    expect(html).toContain('Images need alt text')
    expect(html).toContain('Add descriptive alt text.')
    expect(html.match(/Add alternative text to images\./g)).toHaveLength(1)
    expect(html.match(/Add descriptive alt text\./g)).toHaveLength(1)
  })
})
