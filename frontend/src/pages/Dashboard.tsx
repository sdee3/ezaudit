import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { auditService } from '../services/auditService'
import type { Audit } from '../types'
import { useEcho } from '../hooks/useEcho'
import {
  Box,
  Button,
  Container,
  Heading,
  Stack,
  Text,
  Badge,
  Spinner,
  SimpleGrid,
} from '@chakra-ui/react'

export const Dashboard = () => {
  const { user } = useAuth()
  const [audits, setAudits] = useState<Audit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAudits()
  }, [])

  useEcho(user?.id || 0, (updatedAudit) => {
    setAudits((prevAudits) =>
      prevAudits.map((audit) =>
        audit.id === updatedAudit.id ? updatedAudit : audit
      )
    )
  })

  const loadAudits = async () => {
    try {
      const data = await auditService.getAudits()
      setAudits(data)
    } catch (error) {
      console.error('Failed to load audits:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: 'yellow',
      processing: 'blue',
      completed: 'green',
      failed: 'red',
    }
    return <Badge colorScheme={colorMap[status] || 'gray'}>{status}</Badge>
  }

  const handleDownload = async (id: number) => {
    const url = auditService.downloadPDFUrl(id)
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <Container centerContent py={20}>
        <Spinner size="xl" />
      </Container>
    )
  }

  return (
    <Container maxW="6xl" py={8}>
      <Stack gap={6}>
        <Heading>Welcome back, {user?.name}</Heading>
        
        {audits.length === 0 ? (
          <Box textAlign="center" py={10}>
            <Text color="gray.600">No audits yet. Submit your first audit from the home page!</Text>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
            {audits.map((audit) => (
              <Box key={audit.id} p={6} bg="white" borderRadius="md" boxShadow="sm" borderWidth={1}>
                <Heading size="md" mb={2}>{audit.domain}</Heading>
                <Badge colorScheme="blue" mb={4}>{getStatusBadge(audit.status)}</Badge>
                <Text><strong>Requested:</strong> {new Date(audit.created_at).toLocaleDateString()}</Text>
                <Text><strong>Email:</strong> {audit.email}</Text>
                {audit.status === 'completed' && audit.lighthouse_result && (
                  <Box mt={4}>
                    <Text><strong>Accessibility:</strong> {Math.round(audit.lighthouse_result.accessibility)}</Text>
                    <Text><strong>Performance:</strong> {Math.round(audit.lighthouse_result.performance)}</Text>
                    <Text><strong>Best Practices:</strong> {Math.round(audit.lighthouse_result.best_practices)}</Text>
                    <Text><strong>SEO:</strong> {Math.round(audit.lighthouse_result.seo)}</Text>
                  </Box>
                )}
                {audit.status === 'completed' && (
                  <Button
                    mt={4}
                    onClick={() => handleDownload(audit.id)}
                    colorScheme="blue"
                    size="sm"
                  >
                    Download PDF
                  </Button>
                )}
              </Box>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  )
}