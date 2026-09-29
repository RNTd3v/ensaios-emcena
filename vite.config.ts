import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: {
    __APP_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'favicon-96x96.png', 'apple-touch-icon.png'],
      // Único manifest do app (o `public/site.webmanifest` antigo saiu — o navegador usava ele por
      // vir primeiro no HTML, e ele não tinha ícone "any", o que tirava o "Instalar app" do Chrome).
      // O ícone é fundo preto com o logo no centro (zona segura), então serve como any e maskable.
      manifest: {
        id: '/',
        name: 'Musical Vila Esperança',
        short_name: 'Vila Esperança',
        description: 'Ensaios, cenas, músicas e avisos do Musical Vila Esperança — #EMCENA575',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1c1620',
        background_color: '#000000',
        categories: ['entertainment', 'productivity'],
        // Atalhos ao segurar o ícone do app (Android; no iPhone não aparecem).
        shortcuts: [
          { name: 'Próximo ensaio', short_name: 'Início', url: '/', icons: [{ src: '/web-app-manifest-192x192.png', sizes: '192x192' }] },
          { name: 'Cenas', short_name: 'Cenas', url: '/cenas', icons: [{ src: '/web-app-manifest-192x192.png', sizes: '192x192' }] },
          { name: 'Músicas', short_name: 'Músicas', url: '/musicas', icons: [{ src: '/web-app-manifest-192x192.png', sizes: '192x192' }] },
          { name: 'Notificações', short_name: 'Avisos', url: '/notificacoes', icons: [{ src: '/web-app-manifest-192x192.png', sizes: '192x192' }] },
        ],
        icons: [
          { src: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
