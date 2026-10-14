import { Link, Text } from '@chakra-ui/react'

export const ForgotPasswordCTA = ({ onClick }: { onClick: () => void }) => (
  <Text align="center" fontSize="lg" mb={4} color="gray.600">
    <Link color="blue.400" onClick={onClick}>
      Forgot password?
    </Link>
  </Text>
)
