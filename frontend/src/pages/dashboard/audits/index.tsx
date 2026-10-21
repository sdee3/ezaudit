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
import { useQuery } from 'convex/react'
import { useContext } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from 'convex/_generated/api'

import { BreadcrumbLink } from '../../../models'
import { auditDateLabel, auditStatusLabel, ROUTES, scoreLabel } from '../../../utils'
import {
  Breadcrumbs,
  Loading,
  NoResults,
  RequireSignIn,
  AuthContext,
} from '../../../components'
import { Head } from '../../../head'

const BREADCRUMB_LINKS: BreadcrumbLink[] = [
  {
    route: ROUTES.dashboard,
    name: 'Dashboard',
  },
]

const AuditsIndex = () => {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  // Reactive subscription: the table updates live as audits progress.
  const audits = useQuery(api.audits.listMine, user ? {} : 'skip')

  if (!user) return <RequireSignIn />
  if (audits === undefined) return <Loading />

  if (audits.length === 0) {
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
          <Table width="100%" variant="striped" colorScheme="blue">
            <Thead>
              <Tr>
                <Th>Domain</Th>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th>Accessibility</Th>
                <Th>Best practices</Th>
                <Th>Performance</Th>
                <Th>SEO</Th>
              </Tr>
            </Thead>
            <Tbody>
              {audits.map(audit => (
                <Tr
                  key={audit._id}
                  cursor="pointer"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(ROUTES.audit(audit._id))}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      event.currentTarget.click()
                    }
                  }}
                >
                  <Td>
                    <a
                      href={audit.domain}
                      rel="noopener noreferrer"
                      target="_blank"
                      onClick={event => event.stopPropagation()}
                    >
                      {audit.domain}
                    </a>
                  </Td>
                  <Td>{auditDateLabel(audit.date_of_request)}</Td>
                  <Td>{auditStatusLabel(audit.status)}</Td>
                  <Td>{scoreLabel(audit, 'accessibility')}</Td>
                  <Td>{scoreLabel(audit, 'bestPractices')}</Td>
                  <Td>{scoreLabel(audit, 'performance')}</Td>
                  <Td>{scoreLabel(audit, 'seo')}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Container>
    </>
  )
}

export default AuditsIndex
