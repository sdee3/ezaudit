import type { AuditResultCategories, AuditResultParsed } from '../models'

type AuditState = Pick<AuditResultParsed, 'status' | 'audit_result'>

/** Text for each status when the audit has no scores yet. */
const STATUS_LABEL: Record<AuditResultParsed['status'], string> = {
  queued: 'Queued',
  running: 'Running',
  done: '—',
  error: 'Failed',
}

/** Shows the score once the audit has results. Shows the status until then. */
export const scoreLabel = (
  audit: AuditState,
  category: keyof AuditResultCategories
): string | number =>
  audit.audit_result === null
    ? STATUS_LABEL[audit.status]
    : Math.ceil(audit.audit_result[category].score * 100)

/** One sentence that explains the status on the audit page. Null when no note is needed. */
export const statusNote = (status: AuditResultParsed['status']): string | null => {
  switch (status) {
    case 'queued':
      return 'The audit is queued. Scores appear here when it finishes.'
    case 'running':
      return 'The audit is running. Scores appear here when it finishes.'
    case 'error':
      return 'The audit failed. Start a new audit from the home page.'
    case 'done':
      return null
  }
}
