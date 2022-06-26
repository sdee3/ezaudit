/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-empty-function */
// cypress/plugins/index.ts

import { Server } from 'http'
import next from 'next'
import * as nock from 'nock'

/// <reference types="cypress" />

/**
 * @type {Cypress.PluginConfig}
 */
const plugins = async (on, config) => {
  const app = next({ dev: true })
  const handleNextRequests = app.getRequestHandler()
  await app.prepare()

  const customServer = new Server(async (req, res) => {
    return handleNextRequests(req, res)
  })

  await new Promise<void>((resolve, reject) => {
    customServer.listen(3000, () => {
      console.log('> Ready on http://localhost:3000')
      resolve()
    })
  })

  on('task', {
    clearNock() {
      nock.restore()
      nock.cleanAll()

      return null
    },

    async nock({ hostname, method, path, statusCode, body }) {
      nock.activate()

      console.log(
        'nock will: %s %s%s respond with %d %o',
        method,
        hostname,
        path,
        statusCode,
        body
      )

      method = method.toLowerCase()
      nock(hostname)[method](path).reply(statusCode, body)

      return null
    },
  })

  return config
}

export default plugins
