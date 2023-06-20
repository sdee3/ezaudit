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
import Link from 'next/link'
import { useState } from 'react'
import Head from 'next/head'

import { AuditResultParsed, BreadcrumbLink } from '../../../models'
import { ROUTES } from '../../../utils'
import { Breadcrumbs, Loading, NoResults } from '../../../components'

const BREADCRUMB_LINKS: BreadcrumbLink[] = [
  {
    route: ROUTES.dashboard,
    name: 'Dashboard',
  },
]

const AuditsIndex = () => {
  const [audits, setAudits] = useState<AuditResultParsed[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  if (isLoading) return <Loading />

  if (!audits || audits.length === 0) {
    return (
      <>
        <Head>
          <title>Your Audits | EZ Audit</title>
        </Head>
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
      <Head>
        <title>Your Audits | EZ Audit</title>
      </Head>
      <Breadcrumbs links={BREADCRUMB_LINKS} />
      <Container maxW="container.xl">
        <Heading textAlign="center" mb="8">
          Your Audits
        </Heading>
        <Text mb="4">Disclaimer: All scores are on a scale of 0 to 100.</Text>
        <Box overflowX="scroll">
          <Table data-cy="auditsTable" variant="striped" colorScheme="blue">
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
                <Link key={audit.id} href={ROUTES.audit(audit.id)} passHref>
                  <Tr data-cy={`auditTableRow${audit.id}`} cursor="pointer">
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
