import api from './api'
import type { Audit, HomeAuditInputValues } from '../types'

export const auditService = {
  async submitAudit(data: HomeAuditInputValues): Promise<Audit> {
    const response = await api.post<Audit>('/audits', data)
    return response.data
  },

  async getAudits(status?: string): Promise<Audit[]> {
    const params = status ? { status } : {}
    const response = await api.get<Audit[]>('/audits', { params })
    return response.data
  },

  async getAudit(id: number): Promise<Audit> {
    const response = await api.get<Audit>(`/audits/${id}`)
    return response.data
  },

  async downloadPDF(id: number): Promise<Blob> {
    const response = await api.get(`/audits/${id}/download`, {
      responseType: 'blob',
    })
    return response.data
  },

  downloadPDFUrl(id: number): string {
    const baseURL = api.defaults.baseURL
    const token = localStorage.getItem('token')
    return `${baseURL}/audits/${id}/download?token=${token}`
  },
}