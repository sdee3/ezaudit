import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { ApiHandler } from 'sst/node/api'
import lighthouse from 'lighthouse'

export const handler = ApiHandler(async evt => {
  const executablePath = '/opt/homebrew/bin/chromium'
  console.log(evt)

  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      '--disable-web-security',
      '--headless',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-bytecode',
    ],
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: 'new',
    ignoreHTTPSErrors: true,
    debuggingPort: 9222,
  })

  const runnerResult = await lighthouse('https://news.ycombinator.com/', {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['performance'],
  })

  await browser.close()

  return runnerResult.report
})
