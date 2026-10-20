import { describe, expect, it } from 'vitest'

import type { AuditResultCategories } from '../models'
import { auditDateLabel, auditStatusLabel, scoreLabel, statusNote } from './auditStatus'

const RESULT: AuditResultCategories = {
  accessibility: { score: 0.915 },
  bestPractices: { score: 0.5 },
  performance: { score: 0.2 },
  seo: { score: 1 },
}

describe('scoreLabel', () => {
  it('rounds the score up to a whole number when results exist', () => {
    expect(scoreLabel({ status: 'done', audit_result: RESULT }, 'accessibility')).toBe(92)
    expect(scoreLabel({ status: 'done', audit_result: RESULT }, 'seo')).toBe(100)
  })

  it('shows the status instead of a dash while the audit has no results', () => {
    expect(scoreLabel({ status: 'queued', audit_result: null }, 'seo')).toBe('Queued')
    expect(scoreLabel({ status: 'running', audit_result: null }, 'seo')).toBe('Running')
    expect(scoreLabel({ status: 'error', audit_result: null }, 'seo')).toBe('Failed')
  })
})

describe('audit list labels', () => {
  it('formats the request date and status for the audit list', () => {
    expect(auditDateLabel(new Date('2026-10-20T12:00:00Z').getTime())).toBe(
      new Date('2026-10-20T12:00:00Z').toLocaleDateString()
    )
    expect(auditStatusLabel('queued')).toBe('Queued')
    expect(auditStatusLabel('done')).toBe('Done')
  })
})

describe('statusNote', () => {
  it('explains each pending or failed status', () => {
    expect(statusNote('queued')).toContain('queued')
    expect(statusNote('running')).toContain('running')
    expect(statusNote('error')).toContain('failed')
  })

  it('shows a safe reason for a worker request rejection', () => {
    expect(
      statusNote(
        'error',
        'Lighthouse worker failed: HTTP 400 — {"error":"url must be a valid HTTP URL"}\n    at handler (internal path)',
      )
    ).toBe(
      'The audit service rejected the request. Start a new audit from the home page.',
    )
  })

  it('returns null for a finished audit', () => {
    expect(statusNote('done')).toBeNull()
  })
})
