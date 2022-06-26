import {
  Alert as ChakraAlert,
  AlertDescription,
  AlertIcon,
  CloseButton,
  AlertProps,
} from '@chakra-ui/react'
import { FC } from 'react'

type Props = AlertProps & {
  alertTitle?: string
  alertMessage: string
  onCloseCallback?: () => void
}

export const Alert: FC<Props> = ({
  alertMessage,
  alertTitle,
  onCloseCallback,
  ...rest
}) => (
  <ChakraAlert data-cy="alert" status={rest.status} {...rest}>
    <AlertIcon />
    <AlertDescription mx={4}>{alertMessage}</AlertDescription>
    {!!onCloseCallback && (
      <CloseButton
        position="absolute"
        onClick={onCloseCallback}
        right="8px"
        top="8px"
      />
    )}
  </ChakraAlert>
)
