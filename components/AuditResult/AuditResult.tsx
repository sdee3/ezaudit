import { Box, Button, Flex, Heading, Link, Text } from '@chakra-ui/react'
import { ChangeEvent, useContext } from 'react'
import { FiFileText } from 'react-icons/fi'

import { AuditResultParsed } from '../../models'
import { PrintContext } from '../../modules/Print'

interface Props {
  audit: AuditResultParsed
  handleOnSwitchChange: (e: ChangeEvent<HTMLInputElement>) => void
}

export const AuditResult = ({ audit, handleOnSwitchChange }: Props) => {
  const { isPrinting, setIsPrinting } = useContext(PrintContext)

  const handleOnPrintClick = async () => {
    await setIsPrinting(true)

    window.onafterprint = () => setIsPrinting(false)

    window.print()
  }

  return (
    <>
      <Flex mb={8} gap={4} justifyContent="space-between">
        <Heading>Audit Result</Heading>
      </Flex>
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
      <Box my={4}>
        <Heading as="h3" size="lg" mb={4}>
          Options
        </Heading>
        <Flex flexDirection="column" gap={4}>
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
      <Box mt={4} mb={8}>
        <Text>
          <strong>Accessibility: </strong>
          {Math.ceil(audit.audit_result.accessibility.score * 100)}
        </Text>
        <Text>
          <strong>Best Practices: </strong>
          {Math.ceil(audit.audit_result['best-practices'].score * 100)}
        </Text>
        <Text>
          <strong>Performance: </strong>
          {Math.ceil(audit.audit_result.performance.score * 100)}
        </Text>
        <Text>
          <strong>SEO: </strong>
          {Math.ceil(audit.audit_result.seo.score * 100)}
        </Text>
      </Box>
    </>
  )
}
