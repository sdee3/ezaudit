// @vitest-environment jsdom
import { ChakraProvider } from '@chakra-ui/react'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../../../components/Auth'
import { User } from '../../../models'
import { AuditForm } from '../../../components/AuditForm/AuditForm'
import AuditsIndex from './index'

const { mockUseQuery, mockUseMutation, mockSubmitAudit } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(),
  mockSubmitAudit: vi.fn(),
}))

vi.mock('convex/react', () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
}))

const user: User = { id: 'user-1', email: 'owner@example.com', name: null }
const audit = {
  _id: 'audit-1',
  _creationTime: 1,
  userId: user.id,
  email: user.email,
  domain: 'example.com',
  status: 'done',
  audit_result: null,
  is_public: false,
  date_of_request: 1,
  createdAt: 1,
  updatedAt: 1,
}

let root: Root | undefined
let host: HTMLDivElement | undefined

const LocationLabel = () => {
  const location = useLocation()
  return createElement('output', { 'data-testid': 'location' }, `${location.pathname}${location.search}`)
}

const renderAt = (path: string) => {
  const container = document.createElement('div')
  host = container
  document.body.append(container)
  const mountedRoot = createRoot(container)
  root = mountedRoot
  act(() => {
    mountedRoot.render(
      <ChakraProvider>
        <MemoryRouter initialEntries={[path]}>
          <AuthContext.Provider value={{
            user,
            accessToken: null,
            setUserData: () => undefined,
            clearUser: () => undefined,
          }}>
            <Routes>
              <Route path="/" element={<AuditForm />} />
              <Route path="/dashboard/audits" element={<AuditsIndex />} />
              <Route path="/dashboard/audits/:id" element={<LocationLabel />} />
            </Routes>
          </AuthContext.Provider>
        </MemoryRouter>
      </ChakraProvider>
    )
  })
}

const flush = () => act(async () => {
  await new Promise(resolve => setTimeout(resolve, 0))
})

beforeEach(() => {
  mockUseQuery.mockReturnValue([audit])
  mockUseMutation.mockReturnValue(mockSubmitAudit)
  mockSubmitAudit.mockReset()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
})

afterEach(() => {
  const mountedRoot = root
  if (mountedRoot) act(() => mountedRoot.unmount())
  host?.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('audit navigation', () => {
  it('opens an audit row without a confirmation prompt', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt('/dashboard/audits')
    const container = host!

    const row = container.querySelector('tr[role="link"]')
    expect(row).not.toBeNull()
    act(() => row?.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/dashboard/audits/audit-1')
    expect(confirm).not.toHaveBeenCalled()
  })

  it('shows the Chakra confirmation on homepage submission for an existing domain', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt('/')
    const container = host!
    const input = container.querySelector<HTMLInputElement>('#domain')!
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(input, 'https://www.example.com/new-path')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    await flush()

    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('Open the existing audit for example.com?')
    expect(confirm).not.toHaveBeenCalled()
    expect(mockSubmitAudit).not.toHaveBeenCalled()

    const openButton = [...document.querySelectorAll('button')].find(button => button.textContent?.includes('Open audit'))
    expect(openButton).toBeDefined()
    act(() => openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/dashboard/audits/audit-1?highlightRestart=1')
  })
})
