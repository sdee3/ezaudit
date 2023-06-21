import { SSTConfig } from 'sst'
import { Api, NextjsSite } from 'sst/constructs'
import * as lambda from 'aws-cdk-lib/aws-lambda'

export default {
  config(_input) {
    return {
      name: 'ezaudit-fe',
      region: 'us-east-1',
    }
  },
  stacks(app) {
    app.stack(function Site({ stack }) {
      const api = new Api(stack, 'api', {
        routes: {
          'GET /': {
            function: {
              handler: 'functions/audit.handler',
              nodejs: {
                install: [
                  'puppeteer-core',
                  '@sparticuz/chromium',
                  'lighthouse',
                ],
              },
              timeout: 60,
              memorySize: '2 GB',
              runtime: 'nodejs18.x',
              layers: [
                new lambda.LayerVersion(stack, 'ChromeLayer', {
                  code: lambda.Code.fromAsset('layers/chrome'),
                }),
                new lambda.LayerVersion(stack, 'LighthousePuppeteerLayer', {
                  code: lambda.Code.fromAsset('layers/lighthouse'),
                }),
              ],
            },
          },
        },
      })

      const site = new NextjsSite(stack, 'site', {
        path: '.',
        bind: [api],
      })

      stack.addOutputs({
        ApiUrl: api.url,
        SiteUrl: site.url,
      })
    })
  },
} satisfies SSTConfig
