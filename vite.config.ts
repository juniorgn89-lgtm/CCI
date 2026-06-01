import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    // basicSsl(), // enable for local HTTPS testing
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'Visor360 - Gestão de Postos',
        short_name: 'Visor360',
        description: 'Dashboard analítico para redes de postos de combustível',
        theme_color: '#1e3a5f',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/web\.qualityautomacao\.com\.br\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 30, // 30 min
              },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Só separamos libs PESADAS e carregadas sob demanda (lazy) — elas
        // entram DEPOIS do vendor/react, então nunca pegam o React indefinido.
        //
        // ⚠️ NÃO separar o React (nem react-dom/scheduler) num chunk próprio:
        // libs como `use-sync-external-store` (zustand/react-query) acessam
        // `React.useLayoutEffect` na INICIALIZAÇÃO do módulo. Se ficarem num
        // chunk diferente do React e forem avaliadas antes, dá
        // "Cannot read properties of undefined (reading 'useLayoutEffect')".
        // Por isso react + router + query + radix + icons + zustand + resto
        // ficam TODOS juntos no `vendor` (avaliação ordenada dentro do chunk).
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory-vendor') || id.includes('internmap')) return 'charts'
          if (id.includes('leaflet')) return 'maps'
          if (id.includes('@supabase')) return 'supabase'
          return 'vendor'
        },
      },
    },
  },
})
