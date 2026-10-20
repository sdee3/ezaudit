import { describe, expect, it } from 'vitest'

import type { AuditResultCategories } from '../models'
import { scoreLabel, statusNote } from './auditStatus'

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

describe('statusNote', () => {
  it('explains each pending or failed status', () => {
    expect(statusNote('queued')).toContain('queued')
    expect(statusNote('running')).toContain('running')
    expect(statusNote('error')).toContain('failed')
  })

  it('returns null for a finished audit', () => {
    expect(statusNote('done')).toBeNull()
  })
})
