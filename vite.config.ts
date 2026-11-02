import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'taku.png', 'taku-384.png'],
      workbox: {
        /**
         * pdf.js queda FUERA del precache.
         *
         * Pesa más que toda la app junta y solo lo necesita quien importa un
         * resumen. Precachearlo haría que cada instalación de la PWA baje
         * medio mega de una librería que la mayoría no va a usar nunca.
         *
         * Afuera del precache no desaparece: se baja por red la primera vez
         * que alguien abre la importación, que es justo cuando hace falta.
         */
        globIgnores: ['**/pdf.min-*.js', '**/pdf.worker.min-*.mjs', '**/pdf.worker.min-*.js']
      },
      manifest: {
        name: 'TAKU — Tu día, en orden.',
        short_name: 'TAKU',
        lang: 'es',
        description: 'Tu día, en orden. Calendario, gastos, facturas y tareas en un solo lugar.',
        theme_color: '#16803C',
        background_color: '#FBF9F5',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
