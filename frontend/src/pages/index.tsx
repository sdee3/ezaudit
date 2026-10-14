import { Box, Center, Container, Flex, Grid, Heading } from '@chakra-ui/react'
import { Fragment } from 'react'
import Typewriter, { TypewriterClass } from 'typewriter-effect'

import { AuditForm } from '../components'
import { Head } from '../head'

const HomePage = () => {
  const onTypewriterInit = (typewriter: TypewriterClass) => {
    typewriter
      .typeString('greatest')
      .pauseFor(3000)
      .deleteAll()
      .typeString('smartest')
      .pauseFor(3000)
      .deleteAll()
      .typeString('simplest')
      .pauseFor(3000)
      .deleteAll()
      .start()
  }

  return (
    <Fragment>
      <Head title="EZ Audit" />
      <Center>
        <Container maxW="container.xl">
          <Grid
            gridTemplateColumns={{ sm: '1fr', md: '1fr auto' }}
            gridTemplateRows={{ sm: 'auto auto', md: '1fr' }}
          >
            <Flex
              direction="column"
              justifyContent={{ sm: 'flex-start', md: 'center' }}
              gap="10"
            >
              <Heading mb={{ sm: '5', md: '20' }}>
                {'The '}
                <Box display="inline-block" mx="2">
                  <Typewriter
                    onInit={onTypewriterInit}
                    options={{ loop: true }}
                  />
                </Box>
                audit tool for your business.
              </Heading>

              <AuditForm />
            </Flex>
            <Flex justifyContent="center">
              <Box width={{ sm: '80vw', md: 'container.sm' }}>
                <img
                  alt="EZ Audit Hero Cover"
                  src="/static/img/EZAudit-Home-Futuristic.svg"
                  width={800}
                  height={600}
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              </Box>
            </Flex>
          </Grid>
        </Container>
      </Center>
    </Fragment>
  )
}

export default HomePage
