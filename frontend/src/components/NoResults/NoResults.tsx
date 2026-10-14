import { Box, Button, Flex, Heading } from '@chakra-ui/react'
import { Link } from 'react-router-dom'

import { ROUTES } from '../../utils'

interface Props {
  asError404?: boolean
}

export const NoResults = ({ asError404 = false }: Props) => {
  return (
    <>
      {asError404 && <Heading textAlign="center">Page Not Found</Heading>}
      {!asError404 && (
        <Heading
          as="h2"
          fontSize="2xl"
          mt="8"
          textAlign="center"
          fontWeight="bold"
        >
          No results found.
        </Heading>
      )}
      <Flex justifyContent="center">
        <Box width="fit-content">
          <img
            alt="EZ Audit No Results Found"
            src={
              asError404
                ? '/static/img/EZAudit-Not-Found.svg'
                : '/static/img/EZAudit-Empty-State.svg'
            }
            width={500}
            height={400}
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </Box>
      </Flex>

      <Flex justifyContent="center">
        <Button as={Link} to={ROUTES.home} variant="outline" colorScheme="blue">
          Create your first audit now!
        </Button>
      </Flex>
    </>
  )
}
