import type { AuditResultCategories, AuditResultParsed } from '../models'

type AuditState = Pick<AuditResultParsed, 'status' | 'audit_result'>

/** Text for each status when the audit has no scores yet. */
const STATUS_LABEL: Record<AuditResultParsed['status'], string> = {
  queued: 'Queued',
  running: 'Running',
  done: 'Done',
  error: 'Failed',
}

export const auditStatusLabel = (status: AuditResultParsed['status']): string =>
  STATUS_LABEL[status]

export const auditDateLabel = (date: number): string =>
  new Date(date).toLocaleDateString()

/** Shows the score once the audit has results. Shows the status until then. */
export const scoreLabel = (
  audit: AuditState,
  category: keyof AuditResultCategories
): string | number =>
  audit.audit_result === null
    ? audit.status === 'done' ? '—' : STATUS_LABEL[audit.status]
    : Math.ceil(audit.audit_result[category].score * 100)

/** Lighthouse colors: red below 50, amber below 90, and green from 90. */
export const scoreColorScheme = (score: number): 'red' | 'orange' | 'green' =>
  score < 50 ? 'red' : score < 90 ? 'orange' : 'green'

/** One sentence that explains the status on the audit page. Null when no note is needed. */
export const statusNote = (
  status: AuditResultParsed['status'],
  error?: string
): string | null => {
  switch (status) {
    case 'queued':
      return 'The audit is queued. Scores appear here when it finishes.'
    case 'running':
      return 'The audit is running. Scores appear here when it finishes.'
    case 'error':
      if (/Lighthouse worker failed: HTTP 400\b/i.test(error ?? '')) {
        return 'The audit service rejected the request. Start a new audit from the home page.'
      }
      return 'The audit failed. Start a new audit from the home page.'
    case 'done':
      return null
  }
}
