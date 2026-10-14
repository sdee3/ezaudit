import { useCallback, useState } from 'react'

import { ApiResponse } from '../../models'

/**
 * Network stand-in for this wave. Nothing is sent, including passwords.
 * A later phase replaces this with Convex calls.
 */
const useApi = () => {
  const [parsedEmail, setParsedEmail] = useState<string | null>(null)

  const fetchFromApi = useCallback(
    async (
      url: string,
      method: 'GET' | 'POST' | 'PUT' | 'DELETE',
      _body?: object
    ): Promise<ApiResponse> => {
      if (url === '/api/audits' && method === 'GET') {
        return { status: 200, message: [] }
      }

      return { status: 404, message: '' }
    },
    []
  )

  const fetchEmailDataFromUrl = useCallback(
    async (_potentialEmail?: string, _isPasswordReset = false) => {
      return
    },
    []
  )

  const clearParsedEmail = useCallback(() => setParsedEmail(null), [])

  return { fetchFromApi, fetchEmailDataFromUrl, parsedEmail, clearParsedEmail }
}

export { useApi }
