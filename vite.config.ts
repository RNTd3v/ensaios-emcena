import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.svg'],
      manifest: {
        name: 'Vila Esperança',
        short_name: 'Vila Esperança',
        description: 'Inscrição e controle de ensaios do musical de Natal',
        theme_color: '#7c2d12',
        background_color: '#7c2d12',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icons/icon.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: 'icons/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Fotos do Storage (figurinos, dependentes) ficam no aparelho depois da primeira vez —
        // economiza o download do Storage. A URL do Storage muda quando o arquivo é trocado, então
        // não tem risco de mostrar foto velha. Músicas são guardadas pelo app (src/lib/midiaCache.ts),
        // porque o player baixa o áudio em pedaços. Avatares do Google (googleusercontent.com) NÃO
        // passam por aqui: o CSP do site vale pro sw.js também e não libera esse domínio no
        // connect-src — as fotos quebravam.
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) => url.hostname === 'firebasestorage.googleapis.com' && request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'midia-imagens',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 60, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
})
