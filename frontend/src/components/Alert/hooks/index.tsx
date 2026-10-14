import { useCallback, useState } from 'react'

import { AlertData } from '../../../models'

const INITIAL_ALERT_VALUE: AlertData = { message: '', state: null }

const useAlert = () => {
  const [alertMessage, setAlertMessage] =
    useState<AlertData>(INITIAL_ALERT_VALUE)

  const onAlertClose = useCallback(() => {
    setAlertMessage(INITIAL_ALERT_VALUE)
  }, [])

  return {
    alertMessage,
    setAlertMessage,
    onAlertClose,
  }
}

export default useAlert
