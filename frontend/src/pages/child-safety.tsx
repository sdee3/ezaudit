import {
  Container,
  Heading,
  Link,
  ListItem,
  Text,
  UnorderedList,
  VStack,
} from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'

import { Head } from '../head'
import { ROUTES } from '../utils'

export default function ChildSafetyPage() {
  return (
    <Container maxW="container.md" py={{ base: 4, md: 10 }}>
      <Head title="Child safety standards | EZ Audit" />
      <VStack align="stretch" spacing={5}>
        <Heading size="lg">EZ Audit child safety standards</Heading>
        <Text>
          These standards apply to the EZ Audit mobile app and website at
          ezaudit.me.
        </Text>
        <Text>
          EZ Audit prohibits child sexual abuse and exploitation (CSAE). This
          includes child sexual abuse material (CSAM), grooming, sexual
          extortion, and attempts to exploit or sexualize children.
        </Text>
        <Text>
          No person may use EZ Audit to create, request, upload, share, promote,
          or link to CSAE or CSAM. EZ Audit reviews child safety reports. We may
          restrict accounts or report suspected illegal activity to the proper
          authorities.
        </Text>
        <div>
          <Heading size="md" mb={2}>
            Report a child safety concern
          </Heading>
          <Text>
            Send a report through the{' '}
            <Link
              as={RouterLink}
              to={ROUTES.feedback}
              color="blue.600"
              textDecoration="underline"
            >
              in-app feedback form
            </Link>
            . Select “Child safety concern” and describe the issue.
          </Text>
        </div>
        <div>
          <Heading size="md" mb={2}>
            Child safety contact
          </Heading>
          <Text>
            Contact EZ Audit at{' '}
            <Link
              href="mailto:hello@ezaudit.me"
              color="blue.600"
              textDecoration="underline"
            >
              hello@ezaudit.me
            </Link>{' '}
            about child safety matters.
          </Text>
        </div>
        <UnorderedList spacing={1}>
          <ListItem>Do not include sexual images of children in a report.</ListItem>
          <ListItem>Include a URL or account detail when it helps us review the report.</ListItem>
        </UnorderedList>
      </VStack>
    </Container>
  )
}
