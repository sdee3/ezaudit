import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildIdentityAccountUrl,
  buildIdentitySignInUrl,
  buildIdentitySignUpUrl,
  consumeSignInRedirectPath,
  readSignInTicket,
  rememberSignInRedirectPath,
  stripSignInTicketFromUrl,
} from './identity'

describe('identity', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('builds the SDEE3 Identity sign-in URL with app slug and redirect_url', () => {
    vi.stubEnv('VITE_CLERK_SIGN_IN_URL', 'https://identity.sdee3.com/sign-in')

    expect(buildIdentitySignInUrl('http://localhost:5173', '/dashboard')).toBe(
      'https://identity.sdee3.com/sign-in?app=ezaudit&redirect_url=http%3A%2F%2Flocalhost%3A5173%2Fsso-callback'
    )
  })

  it('falls back to the default hub sign-in URL', () => {
    vi.stubEnv('VITE_CLERK_SIGN_IN_URL', '')

    expect(
      buildIdentitySignInUrl('https://ezaudit.sdee3.com', '/dashboard')
    ).toBe(
      'https://identity.sdee3.com/sign-in?app=ezaudit&redirect_url=https%3A%2F%2Fezaudit.sdee3.com%2Fsso-callback'
    )
  })

  it('builds the hub sign-up URL', () => {
    vi.stubEnv('VITE_CLERK_SIGN_UP_URL', 'https://identity.sdee3.com/sign-up')

    expect(buildIdentitySignUpUrl('http://localhost:5173')).toBe(
      'https://identity.sdee3.com/sign-up?app=ezaudit&redirect_url=http%3A%2F%2Flocalhost%3A5173%2Fsso-callback'
    )
  })

  it('builds the hub account URL from the sign-in endpoint', () => {
    vi.stubEnv('VITE_CLERK_SIGN_IN_URL', 'https://identity.sdee3.com/sign-in')

    expect(buildIdentityAccountUrl()).toBe('https://identity.sdee3.com')
  })

  it('reads the sign-in ticket', () => {
    expect(readSignInTicket({ search: '?token=abc&keep=1' })).toBe('abc')
    expect(readSignInTicket({ search: '?keep=1' })).toBeNull()
    expect(readSignInTicket({ search: '' })).toBeNull()
  })

  it('reads Clerk\'s own ?__clerk_ticket= redirect', () => {
    expect(readSignInTicket({ search: '?__clerk_ticket=xyz' })).toBe('xyz')
    // 'token' takes precedence when both are present.
    expect(readSignInTicket({ search: '?token=abc&__clerk_ticket=xyz' })).toBe(
      'abc'
    )
  })

  it('strips both ticket param names from the URL', () => {
    const replaceState = vi.fn()

    stripSignInTicketFromUrl(
      {
        search: '?__clerk_ticket=xyz&keep=1',
        pathname: '/sso-callback',
        hash: '',
      },
      { state: null, replaceState }
    )

    expect(replaceState).toHaveBeenCalledWith(null, '', '/sso-callback?keep=1')
  })

  it('stores and consumes the remembered sign-in redirect path once', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    }

    vi.stubGlobal('sessionStorage', storage)

    expect(consumeSignInRedirectPath()).toBeNull()

    rememberSignInRedirectPath('/dashboard/audits')
    expect(consumeSignInRedirectPath()).toBe('/dashboard/audits')

    // Second consume pops nothing.
    expect(consumeSignInRedirectPath()).toBeNull()
  })

  it('strips the sign-in ticket from the URL, keeping other params', () => {
    const replaceState = vi.fn()

    stripSignInTicketFromUrl(
      { search: '?token=abc&keep=1', pathname: '/sso-callback', hash: '' },
      { state: null, replaceState }
    )

    expect(replaceState).toHaveBeenCalledWith(null, '', '/sso-callback?keep=1')

    stripSignInTicketFromUrl(
      { search: '?token=abc', pathname: '/sso-callback', hash: '#top' },
      { state: null, replaceState }
    )

    expect(replaceState).toHaveBeenLastCalledWith(
      null,
      '',
      '/sso-callback#top'
    )

    const untouched = vi.fn()
    stripSignInTicketFromUrl(
      { search: '?keep=1', pathname: '/sso-callback', hash: '' },
      { state: null, replaceState: untouched }
    )

    expect(untouched).not.toHaveBeenCalled()
  })
})
