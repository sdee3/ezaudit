import { Box, Button, Flex, Heading } from '@chakra-ui/react'
import Image from 'next/image'
import Link from 'next/link'

import { ROUTES } from '../../utils'

interface Props {
  asError404?: boolean
}

export const NoResults = ({ asError404 = false }: Props) => {
  return (
    <>
      {asError404 && (
        <Heading data-cy="noResultsAs404" textAlign="center">
          Page Not Found
        </Heading>
      )}
      {!asError404 && (
        <Heading
          as="h2"
          fontSize="2xl"
          data-cy="noResultAs200"
          mt="8"
          textAlign="center"
          fontWeight="bold"
        >
          No results found.
        </Heading>
      )}
      <Flex justifyContent="center">
        <Box width="fit-content">
          <Image
            alt="EZ Audit No Results Found"
            src={
              asError404
                ? '/img/EZAudit-Not-Found.svg'
                : '/img/EZAudit-Empty-State.svg'
            }
            width="500"
            height="400"
          />
        </Box>
      </Flex>

      <Flex justifyContent="center">
        <Link passHref href={ROUTES.home}>
          <Button as="a" variant="outline" colorScheme="blue">
            Create your first audit now!
          </Button>
        </Link>
      </Flex>
    </>
  )
}
