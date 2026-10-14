import {
  Box,
  Container,
  Heading,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { useCallback, useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  AuditResultFromAPI,
  AuditResultParsed,
  BreadcrumbLink,
} from '../../../models'
import { AuditResultCategories } from '../../../models/Audit'
import { ROUTES, UNAUTHORIZED_STATUS_CODE } from '../../../utils'
import {
  Breadcrumbs,
  Loading,
  NoResults,
  AuthWrapper,
  AuthContext,
} from '../../../components'
import { useApi } from '../../../utils'
import { Head } from '../../../head'

const BREADCRUMB_LINKS: BreadcrumbLink[] = [
  {
    route: ROUTES.dashboard,
    name: 'Dashboard',
  },
]

const AuditsIndex = () => {
  const [audits, setAudits] = useState<AuditResultParsed[] | null>(null)
  const { fetchFromApi } = useApi()
  const { user, clearUser } = useContext(AuthContext)

  const [isLoading, setIsLoading] = useState(false)

  const fetchAudits = useCallback(async () => {
    try {
      setIsLoading(true)
      const { status, message } = await fetchFromApi('/api/audits', 'GET')

      if (status === UNAUTHORIZED_STATUS_CODE) {
        throw new Error()
      }

      const auditsParsed: AuditResultParsed[] = (
        message as AuditResultFromAPI[]
      ).map(r => ({
        ...r,
        audit_result: JSON.parse(r.audit_result) as AuditResultCategories,
        is_public: r.is_public === 1,
      }))

      setAudits(auditsParsed)
    } catch (err) {
      if (audits?.length !== 0) setAudits([])
      clearUser()
      window.location.reload()
    } finally {
      setIsLoading(false)
    }
  }, [audits?.length, clearUser, fetchFromApi])

  useEffect(() => {
    if (audits !== null) return
    if (user) fetchAudits()
  }, [audits, fetchAudits, user])

  if (isLoading) return <Loading />
  if (!user) return <AuthWrapper />

  if (!audits || audits.length === 0) {
    return (
      <>
        <Head title="Your Audits | EZ Audit" />
        <Container maxW="container.xl">
          <Heading textAlign="center" mb="8">
            Your Audits
          </Heading>
          <NoResults />
        </Container>
      </>
    )
  }

  return (
    <>
      <Head title="Your Audits | EZ Audit" />
      <Breadcrumbs links={BREADCRUMB_LINKS} />
      <Container maxW="container.xl">
        <Heading textAlign="center" mb="8">
          Your Audits
        </Heading>
        <Text mb="4">Disclaimer: All scores are on a scale of 0 to 100.</Text>
        <Box overflowX="scroll">
          <Table variant="striped" colorScheme="blue">
            <Thead>
              <Tr>
                <Th>Domain</Th>
                <Th>Accessibility</Th>
                <Th>Best practices</Th>
                <Th>Performance</Th>
                <Th>SEO</Th>
              </Tr>
            </Thead>
            <Tbody>
              {audits.map(audit => (
                <Link key={audit.id} to={ROUTES.audit(audit.id)}>
                  <Tr cursor="pointer">
                    <Td>
                      <a
                        href={audit.domain}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {audit.domain}
                      </a>
                    </Td>
                    <Td>
                      {Math.ceil(audit.audit_result.accessibility.score * 100)}
                    </Td>
                    <Td>
                      {Math.ceil(
                        audit.audit_result['best-practices'].score * 100
                      )}
                    </Td>
                    <Td>
                      {Math.ceil(audit.audit_result.performance.score * 100)}
                    </Td>
                    <Td>{Math.ceil(audit.audit_result.seo.score * 100)}</Td>
                  </Tr>
                </Link>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Container>
    </>
  )
}

export default AuditsIndex
