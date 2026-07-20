import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // For project pages on GitHub Pages set base to '/<repo>/' (see README).
  base: process.env.BASE_PATH || '/',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'NutriDash · Piano nutrizionale',
        short_name: 'NutriDash',
        description: 'Diario del piano nutrizionale con macro, acqua e storico.',
        lang: 'it',
        theme_color: '#2e7d4f',
        background_color: '#f4f7f4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
})
