import { useCallback, useContext, useState } from 'react'

import { ApiResponse } from '../../models'
import { ERROR_CODES, SUCCESS_STATUS_CODE } from '../constants'
import { AuthContext } from '../../components'

const useApi = () => {
  const { accessToken } = useContext(AuthContext)
  const [parsedEmail, setParsedEmail] = useState<string | null>()

  const fetchFromApi = useCallback(
    async (
      url: string,
      method: 'GET' | 'POST' | 'PUT' | 'DELETE',
      body?: object
    ) => {
      try {
        const response = await fetch(`${process.env.API_URL}${url}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            Authorization: `Bearer ${accessToken}`,
          },
          mode:
            process.env.API_URL === 'https://ezaudit.me'
              ? 'same-origin'
              : 'cors',
          body: body && JSON.stringify(body),
        })

        const parsedBody = await response.json()

        if (ERROR_CODES.includes(response.status)) {
          throw new Error(response.status.toString())
        }

        return {
          message: parsedBody.message,
          status: response.status,
          ...parsedBody,
        } as ApiResponse
      } catch (error) {
        return { status: Number.parseInt(error.message) }
      }
    },
    [accessToken]
  )

  const fetchEmailDataFromUrl = useCallback(
    async (potentialEmail: string | undefined, isPasswordReset = false) => {
      if (!potentialEmail) return

      const resultFromAPI = await fetchFromApi(
        `/api/user/${potentialEmail}${isPasswordReset ? '/y' : '/n'}`,
        'GET'
      )

      if (resultFromAPI.status === SUCCESS_STATUS_CODE) {
        setParsedEmail(resultFromAPI.email as string)
      }
    },
    [fetchFromApi]
  )

  const clearParsedEmail = useCallback(() => setParsedEmail(null), [])

  return { fetchFromApi, fetchEmailDataFromUrl, parsedEmail, clearParsedEmail }
}

export { useApi }
