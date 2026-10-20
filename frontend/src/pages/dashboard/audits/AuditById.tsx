import { Container } from '@chakra-ui/react'
import { useMutation, useQuery } from 'convex/react'
import { ChangeEvent, useContext, useEffect, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { api } from 'convex/_generated/api'

import {
  AuditResult,
  AuthContext,
  RequireSignIn,
  Breadcrumbs,
  Loading,
  NoResults,
} from '../../../components'
import { ResetPasswordForm } from '../../../components/Auth/components/ResetPasswordForm'
import { AuditResultParsed, BreadcrumbLink } from '../../../models'
import { ROUTES } from '../../../utils'
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
  const navigate = useNavigate()
  const { id: auditId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const emailToken = searchParams.get('e')
  const guestToken = searchParams.get('guestToken')
  const { fetchEmailDataFromUrl, parsedEmail, clearParsedEmail } = useApi()

  const toggleVisibility = useMutation(api.audits.setVisibility)
  const removeAudit = useMutation(api.audits.remove)
  const retryAudit = useMutation(api.audits.retry)
  // The server rejects malformed ids by returning null, so the id goes through as-is.
  const ownerOrPublicAudit = useQuery(
    api.audits.get,
    auditId && !parsedEmail && !guestToken ? { id: auditId } : 'skip'
  )
  const guestAudit = useQuery(
    api.audits.getGuest,
    auditId && guestToken && !parsedEmail ? { id: auditId, token: guestToken } : 'skip'
  )
  const audit = guestToken ? guestAudit : ownerOrPublicAudit
  const retryEligible = useQuery(
    api.audits.retryEligibility,
    audit && user ? { id: audit._id } : 'skip'
  )

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

  const handleOnSwitchChange = async (_e: ChangeEvent<HTMLInputElement>) => {
    if (!audit) return

    // The reactive useQuery picks up the patched doc; no local state needed.
    await toggleVisibility({ id: audit._id })
  }

  const handleDelete = async () => {
    if (!audit) return
    await removeAudit({ id: audit._id })
    navigate(ROUTES.userAudits)
  }

  useEffect(() => {
    if (!user && emailToken) fetchEmailDataFromUrl(emailToken)
    if (parsedEmail) navigate(ROUTES.audit(auditId))
  }, [
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

  if (auditId && audit === undefined && !parsedEmail) return <Loading />
  if (!user && !guestToken && !parsedEmail && !audit?.is_public) return <RequireSignIn />
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
            isGuestAccess={!!guestToken && !user}
            handleOnSwitchChange={handleOnSwitchChange}
            retryEligible={retryEligible === true}
            handleRetry={() => retryAudit({ id: audit._id })}
            handleDelete={handleDelete}
          />
        )}
      </Container>
    </>
  )
}

export default AuditByIdOverview
