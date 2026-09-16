import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'SysLoop', short_name: 'SysLoop', lang: 'pl',
      description: 'Trenażer systemu licytacyjnego',
      start_url: '.', display: 'standalone',
      background_color: '#0b1220', theme_color: '#0b1220',
      icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      navigateFallback: '/index.html',
      cleanupOutdatedCaches: true, clientsClaim: true, skipWaiting: true,
      // Tylko powłoka aplikacji. Dane i uwierzytelnianie zawsze przez sieć.
      runtimeCaching: [],
    },
    devOptions: { enabled: false },
  })],
  server: { port: 5175, strictPort: true },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
