import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: {
    'process.env': {},
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 5173,
    // /api/* are Cloud Functions behind Firebase Hosting rewrites (see
    // firebase.json) — forward them to the deployed site in local dev.
    proxy: {
      '/api': { target: 'https://sleevd-7214c.web.app', changeOrigin: true },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // manifest is in public/manifest.json — don't generate one
      manifest: false,
      workbox: {
        // Precache all build output
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Cache Google Fonts
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
