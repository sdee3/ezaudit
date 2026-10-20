import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ConvexSessionGuard } from './ConvexSessionGuard'

const session = {
  isSignedIn: true,
  isLoaded: true,
  isAuthenticated: true,
}

vi.mock('@clerk/react', () => ({
  useAuth: () => ({
    isLoaded: session.isLoaded,
    isSignedIn: session.isSignedIn,
    getToken: async () => null,
    signOut: async () => undefined,
    sessionClaims: { aud: 'convex' },
  }),
}))

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: session.isAuthenticated,
    isRefreshing: false,
  }),
}))

function renderAt(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <ConvexSessionGuard>
        <p>page content</p>
      </ConvexSessionGuard>
    </MemoryRouter>,
  )
}

describe('ConvexSessionGuard', () => {
  it('does not cover the home page for a signed-in user with a ready session', () => {
    const html = renderAt('/')

    expect(html).toContain('page content')
    expect(html).not.toContain('Connecting')
  })

  it('covers the home page while the Convex session handshake is pending', () => {
    session.isAuthenticated = false
    try {
      const html = renderAt('/')

      expect(html).toContain('Connecting')
    } finally {
      session.isAuthenticated = true
    }
  })
})
