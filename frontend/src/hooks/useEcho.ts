import { useEffect } from 'react'
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { useAuth } from '../contexts/AuthContext'
import type { Audit } from '../types'

// Declare Pusher globally for Laravel Echo
declare global {
  interface Window {
    Pusher: typeof Pusher
  }
}

window.Pusher = Pusher

export const useEcho = (userId: number, onAuditUpdate: (audit: Audit) => void) => {
  useEffect(() => {
    if (!userId) return

    const echo = new Echo({
      broadcaster: 'pusher',
      key: import.meta.env.VITE_PUSHER_APP_KEY || 'local',
      cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER || 'mt1',
      wsHost: import.meta.env.VITE_PUSHER_HOST || '127.0.0.1',
      wsPort: import.meta.env.VITE_PUSHER_PORT || 6001,
      wssPort: import.meta.env.VITE_PUSHER_PORT || 6001,
      forceTLS: false,
      enabledTransports: ['ws', 'wss'],
      disableStats: true,
      authEndpoint: `${import.meta.env.VITE_API_URL}/broadcasting/auth`,
      auth: {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      },
    })

    const channel = echo.private(`user.${userId}`)

    channel.listen('AuditUpdated', (e: { audit: Audit }) => {
      onAuditUpdate(e.audit)
    })

    return () => {
      echo.leave(`user.${userId}`)
      echo.disconnect()
    }
  }, [userId, onAuditUpdate])
}