import { Container } from '@chakra-ui/react'
import { ChangeEvent, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import {
  AuditResult,
  AuthContext,
  AuthWrapper,
  Breadcrumbs,
  Loading,
  NoResults,
} from '../../../components'
import { ResetPasswordForm } from '../../../components/Auth/components/ResetPasswordForm'
import {
  AuditResultCategories,
  AuditResultFromAPI,
  AuditResultParsed,
  BreadcrumbLink,
} from '../../../models'
import { ROUTES, UNAUTHORIZED_STATUS_CODE } from '../../../utils'
import { useApi } from '../../../utils'
import { Head, HeadMeta } from '../../../head'

const BREADCRUMB_LINKS: BreadcrumbLink[] = [
  {
    route: ROUTES.dashboard,
    name: 'Dashboard',
  },
  {
    route: ROUTES.userAudits,
    name: 'Audits',
  },
]

const AuditByIdOverview = () => {
  const { user } = useContext(AuthContext)
  const [audit, setAudit] = useState<AuditResultParsed | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { id: auditId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const emailToken = searchParams.get('e')
  const { fetchFromApi, fetchEmailDataFromUrl, parsedEmail, clearParsedEmail } =
    useApi()

  const metaTitle = `EZ Audit | SEO Audit result of ${audit?.domain ?? ''}`
  const metaDescription = `SEO Audit report of ${
    typeof window === 'undefined' ? '' : window.location.href
  } which indicates performance results based on key metrics, such as overall accessibility, load times, SEO.`

  const meta = useMemo<HeadMeta[]>(
    () => [
      { name: 'title', content: metaTitle },
      { name: 'description', content: metaDescription },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://metatags.io/' },
      { property: 'og:title', content: metaTitle },
      { property: 'og:description', content: metaDescription },
      {
        property: 'og:image',
        content:
          'https://metatags.io/assets/meta-tags-16a33a6a8531e519cc0936fbba0ad904e52d35f34a46c97a2c9f6f7dd7d336f2.png',
      },
      { name: 'twitter:card', content: 'summary_large_image' },
      { property: 'twitter:url', content: 'https://metatags.io/' },
      { name: 'twitter:title', content: metaTitle },
      { name: 'twitter:description', content: metaDescription },
      {
        name: 'twitter:image',
        content:
          'https://metatags.io/assets/meta-tags-16a33a6a8531e519cc0936fbba0ad904e52d35f34a46c97a2c9f6f7dd7d336f2.png',
      },
    ],
    [metaDescription, metaTitle]
  )

  const parseAuditFromApi = (resultFromAPI: AuditResultFromAPI) => {
    const auditParsed: AuditResultParsed = {
      ...resultFromAPI,
      audit_result: JSON.parse(
        resultFromAPI.audit_result
      ) as AuditResultCategories,
      is_public: resultFromAPI.is_public === 1,
    }

    return auditParsed
  }

  const handleOnSwitchChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const resultFromAPI = await fetchFromApi(
      `/api/audits/${auditId}/status/${e.target.checked ? 1 : 0}`,
      'PUT'
    )

    if (resultFromAPI.status === UNAUTHORIZED_STATUS_CODE) {
      throw new Error()
    }

    const message = resultFromAPI.message
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      return
    }

    setAudit(parseAuditFromApi(message as AuditResultFromAPI))
  }

  const fetchData = useCallback(async () => {
    if (!auditId) return

    try {
      setLoading(true)

      const resultFromAPI = await fetchFromApi(`/api/audits/${auditId}`, 'GET')

      if (resultFromAPI.status === UNAUTHORIZED_STATUS_CODE) {
        throw new Error()
      }

      const message = resultFromAPI.message
      if (!message || typeof message !== 'object' || Array.isArray(message)) {
        throw new Error()
      }

      setAudit(parseAuditFromApi(message as AuditResultFromAPI))
    } catch (error) {
      setAudit(null)
    } finally {
      setLoading(false)
    }
  }, [fetchFromApi, auditId])

  useEffect(() => {
    if (!user && emailToken) fetchEmailDataFromUrl(emailToken)
    if (!parsedEmail) fetchData()
    if (parsedEmail) navigate(ROUTES.audit(auditId))
  }, [
    fetchData,
    fetchEmailDataFromUrl,
    parsedEmail,
    navigate,
    auditId,
    emailToken,
    user,
  ])

  useEffect(() => {
    if (user && parsedEmail) clearParsedEmail()
  }, [clearParsedEmail, parsedEmail, user])

  useEffect(() => {
    if (user && emailToken) navigate(ROUTES.audit(auditId), { replace: true })
  }, [navigate, user, emailToken, auditId])

  if (loading) return <Loading />
  if (!user && !parsedEmail && !audit?.is_public) return <AuthWrapper />
  if (!audit && !parsedEmail) return <NoResults asError404 />

  return (
    <>
      <Head title={metaTitle} meta={meta} />
      {!parsedEmail && !!user && <Breadcrumbs links={BREADCRUMB_LINKS} />}
      <Container maxW="container.xl">
        {parsedEmail && <ResetPasswordForm email={parsedEmail} />}
        {!parsedEmail && audit && (
          <AuditResult
            audit={audit}
            handleOnSwitchChange={handleOnSwitchChange}
          />
        )}
      </Container>
    </>
  )
}

export default AuditByIdOverview
