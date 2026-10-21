import { ChakraProvider } from '@chakra-ui/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../Auth'
import { User } from '../../models'

import { AuditForm } from './AuditForm'

vi.mock('./hooks', () => ({
  reportHref: () => null,
  useInput: () => ({ isLoading: false, onSubmit: vi.fn(), apiResponseOutput: null }),
}))

const renderAuditForm = (user: User | null) => renderToStaticMarkup(
  <ChakraProvider>
    <MemoryRouter>
      <AuthContext.Provider value={{
        user,
        accessToken: null,
        setUserData: () => undefined,
        clearUser: () => undefined,
      }}>
        <AuditForm />
      </AuthContext.Provider>
    </MemoryRouter>
  </ChakraProvider>
)

describe('AuditForm', () => {
  it('directs signed-out visitors to sign in and hides the submit button', () => {
    const markup = renderAuditForm(null)

    expect(markup).toContain('Sign in')
    expect(markup).toContain('verified email')
    expect(markup).not.toContain('<button')
  })

  it('shows the submit button to signed-in users', () => {
    const markup = renderAuditForm({ id: 'user-1', email: 'owner@example.com', name: null })

    expect(markup).toContain('Submit')
    expect(markup).toContain('<button')
    expect(markup).not.toContain('Sign in')
  })
})
