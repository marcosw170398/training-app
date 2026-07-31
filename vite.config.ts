import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.svg'],
      manifest: {
        name: 'Treino',
        short_name: 'Treino',
        description: 'Planos de treino e histórico de cargas, offline.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#141210',
        theme_color: '#141210',
        icons: [
          { src: '/icons/pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/pwa-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // O motor de OCR (~5 MB) fica FORA do precache: quem só usa PDF com
        // camada de texto nunca baixa esse peso. Ele é buscado na primeira
        // importação de PDF digitalizado e cacheado a partir daí.
        //
        // O Fontsource empacota subconjuntos Unicode que este app (só pt-BR)
        // nunca usa — grego, cirílico, vietnamita. O `unicode-range` do
        // @font-face já impede o navegador de baixá-los em uso normal; sem
        // este filtro, o precache forçaria o download de qualquer forma.
        globIgnores: [
          '**/tesseract/**',
          '**/*-vietnamese-*.woff2',
          '**/*-cyrillic-*.woff2',
          '**/*-cyrillic-ext-*.woff2',
          '**/*-greek-*.woff2',
          '**/*-greek-ext-*.woff2',
        ],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Chunks carregados sob demanda (tela de importação, worker do
            // pdf.js) ficam fora do precache — mas precisam sobreviver offline
            // depois do primeiro uso.
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'chunks-sob-demanda',
              expiration: { maxEntries: 40 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/tesseract/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-engine',
              expiration: { maxEntries: 12 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
