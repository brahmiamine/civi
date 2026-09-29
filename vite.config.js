import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served from https://brahmiamine.github.io/civi/
const base = process.env.BASE_PATH ?? '/civi/';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(version) },
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
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        background_color: '#2447A8',
        theme_color: '#2447A8',
        categories: ['education'],
        prefer_related_applications: false,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Examen blanc', short_name: 'Examen', url: base + '?go=exam', icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Révision intelligente', short_name: 'Réviser', url: base + '?go=smart', icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Reprendre mon test', short_name: 'Reprendre', url: base + '?go=resume', icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }] },
        ],
        // Shown by Android and desktop Chrome in the richer install dialog.
        screenshots: [
          { src: 'screenshots/accueil.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Accueil : préparation et révision du jour' },
          { src: 'screenshots/question.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Question avec correction immédiate' },
          { src: 'screenshots/progression.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Progression et points faibles' },
          { src: 'screenshots/bureau.png', sizes: '1280x800', type: 'image/png', form_factor: 'wide', label: 'Civi sur ordinateur' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}', '**/*latin*.woff2'],
        globIgnores: ['screenshots/**'],
        navigateFallback: base + 'index.html',
        // Reminder notifications (public/sw-reminders.js).
        importScripts: ['sw-reminders.js'],
      },
    }),
  ],
});
