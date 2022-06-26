import { Link, Text } from '@chakra-ui/react'

export const RegisterCTA = ({ onClick }: { onClick: () => void }) => (
  <Text align="center" fontSize="lg" mb={4} color="gray.600">
    Don&apos;t have an account?{' '}
    <Link color="blue.400" onClick={onClick}>
      Register instead!
    </Link>
  </Text>
)
