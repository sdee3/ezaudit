// @ts-check
// eslint-disable-next-line @typescript-eslint/no-var-requires
const withPWA = require('next-pwa')

/**
 * @type {import('next').NextConfig}
 * @type {import('next-pwa')}
 **/

const nextConfig = withPWA({
  env: {
    API_URL: process.env.API_URL,
  },
  pwa: {
    dest: 'public',
  },
})

module.exports = nextConfig
