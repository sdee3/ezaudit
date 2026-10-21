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
        // SW registration + update reload is handled in src/main.tsx so the
        // tab reloads the instant a built update takes control.
        injectRegister: false,
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
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'react',
                test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
                priority: 20,
              },
              {
                name: 'chakra',
                test: /node_modules[\\/](@chakra-ui|@emotion|framer-motion)[\\/]/,
                priority: 15,
              },
              {
                name: 'clerk',
                test: /node_modules[\\/]@clerk[\\/]/,
                priority: 15,
              },
              {
                name: 'convex',
                test: /node_modules[\\/]convex[\\/]/,
                priority: 15,
              },
              {
                name: 'vendor',
                test: /node_modules[\\/]/,
                priority: 10,
              },
            ],
          },
        },
      },
    },
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
