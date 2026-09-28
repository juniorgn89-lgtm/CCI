import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
// import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { readFileSync } from 'fs'
import { RELEASE_NOTES } from './src/releaseNotes'

// Versão única: package.json → __APP_VERSION__ (Configurações › Sobre, tela de
// atualização) e /release-notes.json.
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string }

/**
 * Publica src/releaseNotes.ts como `/release-notes.json` (build e dev). É por
 * esse arquivo que o app ANTIGO, ao clicar em "Atualizar", mostra as novidades
 * da versão NOVA enquanto ela é instalada — o bundle velho não as conhece.
 * JSON fica fora do precache do Service Worker (globPatterns), então a busca
 * vai sempre à rede e pega o deploy mais recente.
 */
const releaseNotesPlugin = (): Plugin => {
  const corpo = () => JSON.stringify({ versao: pkg.version, notas: RELEASE_NOTES })
  return {
    name: 'visor360-release-notes',
    configureServer(server) {
      server.middlewares.use('/release-notes.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(corpo())
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'release-notes.json', source: corpo() })
    },
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    releaseNotesPlugin(),
    // basicSsl(), // enable for local HTTPS testing
    VitePWA({
      // 'prompt' (não 'autoUpdate'): o SW novo fica em wait e a UI mostra um
      // banner "Nova versão — Atualizar". O autoUpdate deixava o celular preso
      // na casca antiga (com CSP velho), sem reload confiável. Aqui o usuário
      // (ou o reload automático do banner) força skipWaiting na hora.
      registerType: 'prompt',
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
        // Quando o navegador entrega um link ao app instalado, reaproveita a
        // janela aberta em vez de abrir outra.
        launch_handler: { client_mode: 'navigate-existing' },
        // Relação com os outros apps da suíte, nos dois sentidos: é o que
        // permite ao Prospecção360 confirmar (getInstalledRelatedApps) que o
        // Visor360 está instalado — e vice-versa. Sem isto, o launcher do outro
        // app não sabe e não pode dizer "instalado" nem "instalar".
        related_applications: [
          { platform: 'webapp', url: 'https://visor360.cci.app.br/manifest.webmanifest' },
          { platform: 'webapp', url: 'https://prospeccao360.cci.app.br/manifest.webmanifest' },
        ],
        icons: [
          {
            src: '/brand/visor360-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/brand/visor360-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/brand/visor360-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
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
