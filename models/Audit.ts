export interface AuditResultFromAPI {
  id: string
  domain: string
  email: string
  audit_result: string
  date_of_request: string
  is_public: number
}

export interface AuditResultParsed {
  id: string
  domain?: string
  email: string
  audit_result: AuditResultCategories
  date_of_request: string
  is_public: boolean
}

export interface AuditResultCategories {
  accessibility: AuditAccessibility
  best_practices: AuditBestPractices
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
