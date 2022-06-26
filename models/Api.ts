export interface ApiResponse extends Record<string, unknown> {
  message?: string | object | object[]
  status?: number
  error?: string
}
