import { useCallback, useState } from 'react'

/**
 * Remaining stub for the legacy password-reset email-token flow only. All real
 * network calls are Convex now (api.audits.* used directly at their consumers).
 */
const useApi = () => {
  const [parsedEmail, setParsedEmail] = useState<string | null>(null)

  const fetchEmailDataFromUrl = useCallback(
    async (_potentialEmail?: string, _isPasswordReset = false) => {
      return
    },
    []
  )

  const clearParsedEmail = useCallback(() => setParsedEmail(null), [])

  return { fetchEmailDataFromUrl, parsedEmail, clearParsedEmail }
}

export { useApi }
