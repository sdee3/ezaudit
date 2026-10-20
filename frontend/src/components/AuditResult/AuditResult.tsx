import {
  Alert as ChakraAlert,
  AlertIcon,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Link,
  Progress,
  Switch,
  Text,
} from '@chakra-ui/react'
import { ChangeEvent, useContext, useMemo } from 'react'
import { FiFileText } from 'react-icons/fi'

import { AuditResultParsed } from '../../models'
import { PrintContext } from '../../modules/Print'
import { ROUTES, scoreLabel, statusNote } from '../../utils'
import { Alert } from '../Alert'
import { AuthContext } from '../Auth'
import { ShareAuditURLModal } from './ShareAuditURLModal'

interface Props {
  audit: AuditResultParsed
  handleOnSwitchChange: (e: ChangeEvent<HTMLInputElement>) => void
}

export const AuditResult = ({ audit, handleOnSwitchChange }: Props) => {
  const { isPrinting, setIsPrinting } = useContext(PrintContext)
  const { user } = useContext(AuthContext)

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
      {!isUserOwnerOfAudit && (
        <Alert
          mb={4}
          alertMessage="You are viewing a publicly available Audit."
        />
      )}
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
        </Flex>
      </Box>
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
                <Text fontWeight="bold">
                  {score}
                  {typeof score === 'number' ? ' / 100' : ''}
                </Text>
              </Flex>
              <Text fontSize="sm" color="gray.600" mb={2}>
                {explanation}
              </Text>
              {typeof score === 'number' && (
                <Progress
                  value={value}
                  max={100}
                  colorScheme="blue"
                  size="sm"
                  aria-label={`${label} score`}
                />
              )}
            </Box>
          )
        })}
      </Box>

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
