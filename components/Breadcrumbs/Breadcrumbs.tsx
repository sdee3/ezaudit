import { Box, Container, Flex } from '@chakra-ui/react'
import Link from 'next/link'
import { Fragment, useContext } from 'react'
import { AiOutlineCaretRight } from 'react-icons/ai'

import { BreadcrumbLink } from '../../models'
import { PrintContext } from '../../modules/Print'
import { ROUTES } from '../../utils'

interface Props {
  links: BreadcrumbLink[]
}

export const Breadcrumbs = ({ links }: Props) => {
  const { isPrinting } = useContext(PrintContext)

  if (links.length === 0) return null

  return (
    <Box
      backgroundColor="blue.600"
      color="white"
      py="2"
      mb="8"
      mt="-10"
      shadow="md"
      display={isPrinting ? 'none' : 'block'}
    >
      <Container maxW="container.xl">
        <Flex alignItems="center">
          <Box mr="2">
            <Link href={ROUTES.home}>Home</Link>
          </Box>
          {links.map(l => (
            <Fragment key={l.name}>
              <AiOutlineCaretRight />
              <Box ml="2" mr="2">
                <Link href={l.route}>{l.name}</Link>
              </Box>
            </Fragment>
          ))}
        </Flex>
      </Container>
    </Box>
  )
}
