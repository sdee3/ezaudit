import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const frontendRoot = path.dirname(fileURLToPath(import.meta.url))

const icon = (size: string) => ({
  src: `/static/manifest/icon-${size}.png`,
  sizes: size,
  type: 'image/png',
})

function googleAnalyticsId(id: string): Plugin {
  return {
    name: 'google-analytics-id',
    transformIndexHtml(html) {
      return html.replaceAll('__GOOGLE_ANALYTICS_ID__', id)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, frontendRoot, 'VITE_')

  return {
    plugins: [
      googleAnalyticsId(env.VITE_GOOGLE_ANALYTICS ?? ''),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'static/favicon.ico',
          'static/manifest/icon-bordered.png',
          'static/manifest/icon-192x192.png',
          'static/manifest/icon-256x256.png',
          'static/manifest/icon-384x384.png',
          'static/manifest/icon-512x512.png',
        ],
        manifest: {
          name: 'EZ Audit',
          short_name: 'EZ Audit',
          description:
            'Audit your website with EZ Audit - the next greatest revolutionary tool for auditing your online business',
          theme_color: '#2663D1',
          background_color: '#ffffff',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          icons: [
            icon('192x192'),
            icon('256x256'),
            icon('384x384'),
            icon('512x512'),
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        'convex/_generated/api': path.resolve(
          frontendRoot,
          '../backend/convex/_generated/api'
        ),
        'convex/_generated/dataModel': path.resolve(
          frontendRoot,
          '../backend/convex/_generated/dataModel'
        ),
        'convex/lib': path.resolve(frontendRoot, '../backend/convex/lib'),
      },
    },
  }
})
