import { ChakraProvider } from '@chakra-ui/react'
import { CookiesProvider } from 'react-cookie'
import CookieConsent from 'react-cookie-consent'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'

import { Layout, NoResults, useAuthContext } from './components'
import { usePrintContext } from './modules/Print'
import AuditsIndex from './pages/dashboard/audits'
import AuditByIdOverview from './pages/dashboard/audits/AuditById'
import DashboardPage from './pages/dashboard'
import PasswordResetPage from './pages/dashboard/password-reset'
import HomePage from './pages'
import TermsConditions from './pages/terms-and-conditions'
import { ROUTES, theme } from './utils'

export function App() {
  const { AuthContext, accessToken, setUserData, clearUser, user } =
    useAuthContext()
  const { PrintContext, isPrinting, setIsPrinting } = usePrintContext()

  return (
    <ChakraProvider theme={theme}>
      <CookiesProvider>
        <BrowserRouter>
          <PrintContext.Provider value={{ isPrinting, setIsPrinting }}>
            <AuthContext.Provider
              value={{ user, accessToken, setUserData, clearUser }}
            >
              <Layout>
                <Routes>
                  <Route path={ROUTES.home} element={<HomePage />} />
                  <Route
                    path={ROUTES.termsAndConditions}
                    element={<TermsConditions />}
                  />
                  <Route path={ROUTES.dashboard} element={<DashboardPage />} />
                  <Route path={ROUTES.userAudits} element={<AuditsIndex />} />
                  <Route
                    path="/dashboard/audits/:id"
                    element={<AuditByIdOverview />}
                  />
                  <Route
                    path={ROUTES.passwordReset}
                    element={<PasswordResetPage />}
                  />
                  <Route path="*" element={<NoResults asError404 />} />
                </Routes>
              </Layout>

              <CookieConsent
                style={{ backgroundColor: theme.colors.primaryDark }}
                buttonStyle={{
                  backgroundColor: theme.colors.white,
                  borderRadius: 4,
                  color: theme.colors.primaryDark,
                }}
              >
                By continuing to use this site, you agree to our usage of
                cookies for enhancing the user experience. See{' '}
                <u>
                  <Link to={ROUTES.termsAndConditions}>
                    Terms and Conditions
                  </Link>
                </u>{' '}
                for more information.
              </CookieConsent>
            </AuthContext.Provider>
          </PrintContext.Provider>
        </BrowserRouter>
      </CookiesProvider>
    </ChakraProvider>
  )
}
