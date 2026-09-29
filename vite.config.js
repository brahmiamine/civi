import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served from https://brahmiamine.github.io/civi/
const base = process.env.BASE_PATH ?? '/civi/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand-icon.svg', 'favicon-32x32.png', 'apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Civi — Test Civique',
        short_name: 'Civi',
        description: 'Entraînement au test civique français : quiz, révisions par thème et examens blancs.',
        lang: 'fr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#2447A8',
        theme_color: '#2447A8',
        categories: ['education'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}', '**/*latin*.woff2'],
        navigateFallback: base + 'index.html',
      },
    }),
  ],
});
