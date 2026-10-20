import { Container, Flex, Spinner } from '@chakra-ui/react'

export const Loading = () => {
  return (
    <Container maxW="container.xl" height="100vh" width="100vw">
      <Flex alignItems="center" justifyContent="center" height="100%">
        <Spinner size="xl" thickness="4px" speed="0.65s" />
      </Flex>
    </Container>
  )
}
