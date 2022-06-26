import {
  Button,
  useDisclosure,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
} from '@chakra-ui/react'
import { useState } from 'react'
import { FiShare } from 'react-icons/fi'
import { RiCheckboxCircleLine } from 'react-icons/ri'

export const ShareAuditURLModal = () => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [isUrlCopied, setIsUrlCopied] = useState(false)

  const onCopyClick = () => {
    if (navigator?.clipboard?.writeText)
      return navigator.clipboard.writeText(window.location.href)
    return Promise.reject('The Clipboard API is not available.')
  }

  const onModalClose = () => {
    setIsUrlCopied(false)
    onClose()
  }

  return (
    <>
      <Button
        variant="outline"
        colorScheme="facebook"
        onClick={onOpen}
        width="fit-content"
      >
        <FiShare /> <Text ml={2}>Share Audit</Text>
      </Button>

      <Modal isOpen={isOpen} onClose={onModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Share Audit</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={4}>
              Click the button below to copy the URL of your audit. If it does
              not work, please select and copy the URL manually.
            </Text>
            <Text color="blue.600">{window.location.href}</Text>
          </ModalBody>

          <ModalFooter>
            <Button
              colorScheme="blue"
              onClick={onCopyClick}
              variant="outline"
              mr={3}
            >
              <Text mr={isUrlCopied ? 2 : 0}>Copy URL</Text>
              {isUrlCopied && <RiCheckboxCircleLine />}
            </Button>
            <Button colorScheme="blue" variant="ghost" onClick={onModalClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
