import { Link, Text } from '@chakra-ui/react'

export const SignInCTA = ({ onClick }: { onClick: () => void }) => (
  <Text align="center" fontSize="lg" mb={4} color="gray.600">
    Already have an account?{' '}
    <Link color="blue.400" onClick={onClick}>
      Sign in now!
    </Link>
  </Text>
)
