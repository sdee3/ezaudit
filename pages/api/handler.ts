import { NextApiRequest, NextApiResponse } from 'next'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import lighthouse from 'lighthouse'

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse
) {
  // Optional: If you'd like to use the legacy headless mode. "new" is the default.
  chromium.setHeadlessMode = true

  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      '--disable-web-security',
      '--headless',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    debuggingPort: 9222,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: 'new',
    ignoreHTTPSErrors: true,
  })

  const runnerResult = await lighthouse('https://news.ycombinator.com/', {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['performance'],
  })

  await browser.close()

  response.status(200).json({
    report: runnerResult.report,
  })
}
