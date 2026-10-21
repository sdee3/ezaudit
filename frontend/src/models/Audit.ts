import type { Id } from 'convex/_generated/dataModel'

/**
 * A real Convex audits document (backend/convex/schema/audits.ts), as returned
 * by api.audits.listMine / api.audits.get / api.audits.setVisibility.
 */
export interface Audit {
  _id: Id<'audits'>
  _creationTime: number
  /** identity.subject of the owner, or null for historical ownerless rows. */
  userId?: string | null
  email?: string
  domain: string
  status: 'queued' | 'running' | 'done' | 'error'
  audit_result: AuditResultCategories | null
  findings?: AuditFinding[]
  report?: {
    finalUrl: string
    fetchedAt: string
    lighthouseVersion: string
    formFactor: string
    metrics: { id: string; title: string; value: number; unit: string; displayValue: string }[]
    checks: { id: string; category: keyof AuditResultCategories; title: string; score: number; displayValue: string; weight: number }[]
  }
  is_public: boolean
  /** ms epoch. */
  date_of_request: number
  error?: string
  createdAt: number
  updatedAt: number
}

/** Matches the Convex doc — the pre-Convex shape was parsed from a JSON string. */
export type AuditResultParsed = Audit

export interface AuditFinding {
  id: string
  category: keyof AuditResultCategories
  title: string
  description: string
  score: number
  suggestedFixes: string[]
}

export interface AuditResultCategories {
  accessibility: AuditAccessibility
  /** Canonical key — Convex validators reject hyphenated identifiers. */
  bestPractices: AuditBestPractices
  performance: AuditPerformance
  seo: AuditSEO
}

export interface AuditAccessibility {
  score: number
}

export interface AuditBestPractices {
  score: number
}

export interface AuditPerformance {
  score: number
}

export interface AuditSEO {
  score: number
}
