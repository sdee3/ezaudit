import { Container } from '@chakra-ui/react'
import { GetServerSideProps, GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import {
  ChangeEvent,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

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

interface Props {
  META_TITLE: string
  META_DESCRIPTION: string
}

const AuditByIdOverview = ({ META_DESCRIPTION, META_TITLE }: Props) => {
  const { user } = useContext(AuthContext)
  const [audit, setAudit] = useState<AuditResultParsed | null>(null)
  const [loading, setLoading] = useState(false)
  const { push, replace, query } = useRouter()
  const { fetchFromApi, fetchEmailDataFromUrl, parsedEmail, clearParsedEmail } =
    useApi()

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
      `/api/audits/${query.auditId}/status/${e.target.checked ? 1 : 0}`,
      'PUT'
    )

    if (resultFromAPI.status === UNAUTHORIZED_STATUS_CODE) {
      throw new Error()
    }

    setAudit(parseAuditFromApi(resultFromAPI.message as AuditResultFromAPI))
  }

  const fetchData = useCallback(async () => {
    if (!query?.auditId) return

    try {
      setLoading(true)

      const resultFromAPI = await fetchFromApi(
        `/api/audits/${query.auditId}`,
        'GET'
      )

      if (resultFromAPI.status === UNAUTHORIZED_STATUS_CODE) {
        throw new Error()
      }

      setAudit(parseAuditFromApi(resultFromAPI.message as AuditResultFromAPI))
    } catch (error) {
      setAudit(null)
    } finally {
      setLoading(false)
    }
  }, [fetchFromApi, query.auditId])

  useEffect(() => {
    !user && query?.e && fetchEmailDataFromUrl(query.e as string)
    !parsedEmail && fetchData()
    parsedEmail && push(ROUTES.audit(query.auditId as string))
  }, [
    fetchData,
    fetchEmailDataFromUrl,
    parsedEmail,
    push,
    query.auditId,
    query.e,
    user,
  ])

  useEffect(() => {
    if (user && parsedEmail) clearParsedEmail()
  }, [clearParsedEmail, parsedEmail, user])

  useEffect(() => {
    if (user && query?.e)
      replace({
        pathname: ROUTES.audit(query.auditId as string),
        query: undefined,
      })
  }, [replace, user, query?.e, query.auditId])

  if (loading) return <Loading />
  if (!user && !parsedEmail && !audit?.is_public) return <AuthWrapper />
  if (!audit && !parsedEmail) return <NoResults asError404 />

  return (
    <>
      <Head>
        <title>{META_TITLE}</title>
        <meta name="title" content={META_TITLE} />
        <meta name="description" content={META_DESCRIPTION} />

        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://metatags.io/" />
        <meta property="og:title" content={META_TITLE} />
        <meta property="og:description" content={META_DESCRIPTION} />
        <meta
          property="og:image"
          content="https://metatags.io/assets/meta-tags-16a33a6a8531e519cc0936fbba0ad904e52d35f34a46c97a2c9f6f7dd7d336f2.png"
        />

        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://metatags.io/" />
        <meta property="twitter:title" content={META_TITLE} />
        <meta property="twitter:description" content={META_DESCRIPTION} />
        <meta
          property="twitter:image"
          content="https://metatags.io/assets/meta-tags-16a33a6a8531e519cc0936fbba0ad904e52d35f34a46c97a2c9f6f7dd7d336f2.png"
        />
      </Head>
      {!parsedEmail && !!user && <Breadcrumbs links={BREADCRUMB_LINKS} />}
      <Container maxW="container.xl">
        {parsedEmail && <ResetPasswordForm email={parsedEmail} />}
        {!parsedEmail && (
          <AuditResult
            audit={audit}
            handleOnSwitchChange={handleOnSwitchChange}
          />
        )}
      </Container>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async ({
  req,
  query,
}: GetServerSidePropsContext) => {
  const { url = '' } = req

  const resultFromAPI = await fetch(
    `${process.env.API_URL}/api/audits/${query.auditId}`
  )
  const resultInJson = await resultFromAPI.json()

  const domain = resultInJson?.message?.domain

  const META_TITLE = `EZ Audit | SEO Audit result of ${domain}`
  const META_DESCRIPTION = `SEO Audit report of ${url} which indicates performance results based on key metrics, such as overall accessibility, load times, SEO.`

  return {
    props: {
      META_TITLE,
      META_DESCRIPTION,
    },
  }
}

export default AuditByIdOverview
