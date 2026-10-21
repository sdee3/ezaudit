import {
  Alert as ChakraAlert,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Link,
  Progress,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Switch,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { ChangeEvent, useContext, useMemo, useRef } from 'react'
import { FiFileText } from 'react-icons/fi'

import { AuditResultParsed } from '../../models'
import { PrintContext } from '../../modules/Print'
import { ROUTES, scoreColorScheme, scoreLabel, statusNote } from '../../utils'
import { Alert } from '../Alert'
import { AuthContext } from '../Auth'
import { ShareAuditURLModal } from './ShareAuditURLModal'

interface Props {
  audit: AuditResultParsed
  handleOnSwitchChange: (e: ChangeEvent<HTMLInputElement>) => void
  retryEligible: boolean
  handleRetry: () => void
  handleDelete: () => void
  isGuestAccess?: boolean
}

const renderFindingText = (value: string) =>
  value.split(/(\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
    return link ? (
      <Link key={index} href={link[2]} target="_blank" rel="noopener noreferrer" color="blue.600">
        {link[1]}
      </Link>
    ) : part
  })

export const AuditResult = ({
  audit,
  handleOnSwitchChange,
  retryEligible,
  handleRetry,
  handleDelete,
  isGuestAccess = false,
}: Props) => {
  const { isPrinting, setIsPrinting } = useContext(PrintContext)
  const { user } = useContext(AuthContext)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const restartDialog = useDisclosure()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const restartCancelRef = useRef<HTMLButtonElement>(null)

  // Same rule as the backend (audits.get, audits.setVisibility): owner means userId match.
  const isUserOwnerOfAudit = useMemo(
    () => !!user && audit.userId === user.id,
    [audit.userId, user]
  )

  const shouldDisplayOptions = useMemo(
    () => !isPrinting && isUserOwnerOfAudit,
    [isPrinting, isUserOwnerOfAudit]
  )

  const handleOnPrintClick = async () => {
    await setIsPrinting(true)

    window.onafterprint = () => setIsPrinting(false)

    window.print()
  }

  return (
    <>
      <Flex mb={8} gap={4} justifyContent="space-between">
        <Heading>
          {isUserOwnerOfAudit ? 'Your Audit Result' : 'Audit Result'}
        </Heading>
      </Flex>
      {!isUserOwnerOfAudit && !isGuestAccess && (
        <Alert
          mb={4}
          alertMessage="You are viewing a publicly available Audit."
        />
      )}
      {isGuestAccess && <Alert mb={4} alertMessage="You are viewing a private report with a secure guest link." />}
      <hr />
      <Text my={4}>
        <strong>Website audited: </strong>
        <Link
          color="blue.600"
          href={audit.domain}
          target="_blank"
          rel="noopener noreferrer"
        >
          {audit.domain}
        </Link>
      </Text>
      <Text mb={4}>
        <strong>Date of audit:</strong>{' '}
        {new Date(audit.date_of_request).toString()}
      </Text>
      {!isPrinting && <hr />}
      <Box
        my={4}
        className="print-hidden"
        display={shouldDisplayOptions ? 'block' : 'none'}
      >
        <Heading as="h3" size="lg" mb={4}>
          Options
        </Heading>
        <Flex flexDirection="column" gap={4}>
          <Flex alignItems="center" gap={4}>
            <FormControl display="flex" width="fit-content">
              <FormLabel htmlFor="audit-visibility-toggle" mb="0">
                Set as Public:
              </FormLabel>
              <Switch
                id="audit-visibility-toggle"
                isChecked={audit.is_public}
                onChange={handleOnSwitchChange}
                size="lg"
              />
            </FormControl>

            {audit.is_public && <ShareAuditURLModal />}
          </Flex>

          <Button
            onClick={handleOnPrintClick}
            display={isPrinting ? 'none' : 'flex'}
            variant="outline"
            colorScheme="facebook"
            width="fit-content"
          >
            <FiFileText /> <Text ml={2}>Export to PDF</Text>
          </Button>
          {isUserOwnerOfAudit && retryEligible && (
            <Button onClick={restartDialog.onOpen} colorScheme="blue" width="fit-content">
              Restart audit
            </Button>
          )}
          {isUserOwnerOfAudit && (
            <Button
              onClick={onOpen}
              colorScheme="red"
              variant="outline"
              width="fit-content"
            >
              Delete audit
            </Button>
          )}
        </Flex>
      </Box>
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete this audit?</AlertDialogHeader>
            <AlertDialogBody>
              This deletes the report and its attempt history. Shared report links will stop working.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDelete} ml={3}>
                Delete audit
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
      <AlertDialog
        isOpen={restartDialog.isOpen}
        leastDestructiveRef={restartCancelRef}
        onClose={restartDialog.onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Restart this audit?</AlertDialogHeader>
            <AlertDialogBody>
              This starts a new audit and replaces the current report.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={restartCancelRef} onClick={restartDialog.onClose}>
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                onClick={() => {
                  restartDialog.onClose()
                  handleRetry()
                }}
                ml={3}
              >
                Restart audit
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
      <hr />
      {audit.status !== 'done' && (
        <ChakraAlert
          status={audit.status === 'error' ? 'error' : 'info'}
          variant="left-accent"
          mt={4}
        >
          <AlertIcon />
          <Text>{statusNote(audit.status, audit.error)}</Text>
        </ChakraAlert>
      )}
      <Box mt={4} mb={8}>
        <Heading as="h2" size="lg" mb={2}>
          Category scores
        </Heading>
        <Text mb={4}>Each score uses the same 0 to 100 scale.</Text>
        <Flex justifyContent="space-between" fontSize="sm" color="gray.600" mb={2}>
          <Text>0 · Needs work</Text>
          <Text>100 · Excellent</Text>
        </Flex>
        {([
          ['accessibility', 'Accessibility', 'How well people with disabilities can use the site.'],
          ['bestPractices', 'Best practices', 'Checks for secure, modern web development.'],
          ['performance', 'Performance', 'Measures page load speed and responsiveness.'],
          ['seo', 'SEO', 'Checks how well search engines can understand the site.'],
        ] as const).map(([category, label, explanation]) => {
          const score = scoreLabel(audit, category)
          const value = typeof score === 'number' ? score : 0

          return (
            <Box key={category} py={3} borderTopWidth="1px" borderColor="gray.200">
              <Flex justifyContent="space-between" alignItems="baseline" gap={4}>
                <Text fontWeight="semibold">{label}</Text>
                {typeof score === 'number' ? (
                  <Badge
                    colorScheme={scoreColorScheme(score)}
                    variant={score === 100 ? 'solid' : 'subtle'}
                    bg={score === 100 ? 'green.700' : undefined}
                    fontSize="md"
                    px={2}
                    py={1}
                  >
                    {score} / 100
                  </Badge>
                ) : <Text fontWeight="bold">{score}</Text>}
              </Flex>
              <Text fontSize="sm" color="gray.600" mb={2}>
                {explanation}
              </Text>
              {typeof score === 'number' && (
                <Progress
                  value={value}
                  max={100}
                  colorScheme={scoreColorScheme(value)}
                  size="sm"
                  aria-label={`${label} score`}
                  sx={value === 100 ? { '& > div': { bg: 'green.700' } } : undefined}
                />
              )}
            </Box>
          )
        })}
      </Box>
      {audit.report && (
        <Box mb={8} p={{ base: 4, md: 6 }} borderRadius="xl" bg="gray.50" borderWidth="1px" borderColor="gray.200">
          <Flex justifyContent="space-between" alignItems="baseline" gap={4} wrap="wrap" mb={4}>
            <Heading as="h2" size="lg">Page experience</Heading>
            <Text fontSize="sm" color="gray.600">
              {audit.report.formFactor} audit · Lighthouse {audit.report.lighthouseVersion}
            </Text>
          </Flex>
          <SimpleGrid columns={{ base: 2, md: 5 }} spacing={3}>
            {audit.report.metrics.map((metric, index) => (
              <Stat key={metric.id} p={3} bg={['blue.50', 'purple.50', 'teal.50', 'orange.50', 'pink.50'][index % 5]} borderRadius="lg">
                <StatLabel fontSize="xs">{metric.title}</StatLabel>
                <StatNumber fontSize="xl">{metric.displayValue || `${metric.value}${metric.unit}`}</StatNumber>
              </Stat>
            ))}
          </SimpleGrid>
          <Flex mt={4} gap={3} wrap="wrap">
            {(['performance', 'accessibility', 'bestPractices', 'seo'] as const).map((category) => {
              const checks = audit.report!.checks.filter((check) => check.category === category)
              const passed = checks.filter((check) => check.score >= 0.9).length
              const labels = { performance: 'Performance', accessibility: 'Accessibility', bestPractices: 'Best practices', seo: 'SEO' }
              return (
                <Text key={category} px={3} py={1} borderRadius="full" bg="white" borderWidth="1px" fontSize="sm">
                  {labels[category]} · {passed}/{checks.length} checks passed
                </Text>
              )
            })}
          </Flex>
          <Text mt={3} fontSize="xs" color="gray.600">
            Audited {new Date(audit.report.fetchedAt).toLocaleString()} · {audit.report.checks.length} checks · {audit.report.finalUrl}
          </Text>
        </Box>
      )}
      {audit.findings !== undefined && (
        <Box mb={8}>
          <Heading as="h2" size="lg" mb={2}>
            Findings
          </Heading>
          {audit.findings.length === 0 ? (
            <Text>No Lighthouse checks failed.</Text>
          ) : (
            audit.findings.map((finding) => (
              <Box
                key={`${finding.category}:${finding.id}`}
                py={4}
                borderTopWidth="1px"
                borderColor="gray.200"
              >
                <Text fontSize="sm" color="gray.600" mb={1}>
                  {{
                    accessibility: 'Accessibility',
                    bestPractices: 'Best practices',
                    performance: 'Performance',
                    seo: 'SEO',
                  }[finding.category]}
                </Text>
                <Heading as="h3" size="md" mb={2}>
                  {finding.title}
                </Heading>
                <Text mb={finding.suggestedFixes.length > 0 ? 3 : 0}>{renderFindingText(finding.description)}</Text>
                {finding.suggestedFixes.length > 0 && (
                  <Box as="ul" pl={5}>
                    {finding.suggestedFixes.map((fix) => (
                      <Text as="li" key={fix}>
                        {renderFindingText(fix)}
                      </Text>
                    ))}
                  </Box>
                )}
              </Box>
            ))
          )}
        </Box>
      )}

      {!isUserOwnerOfAudit && !user && (
        <ChakraAlert status="info" variant="left-accent">
          <AlertIcon />
          <Text>
            Want to audit your website and see what you need to improve?{' '}
            <Link href={ROUTES.dashboard}>
              <Text as="u">Sign up on EZ Audit now!</Text>
            </Link>
          </Text>
        </ChakraAlert>
      )}
    </>
  )
}
