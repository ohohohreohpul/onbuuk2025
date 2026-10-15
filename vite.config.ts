import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The new worker takes over at once; src/lib/appUpdates.ts reloads open tabs at a safe moment.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['apple-touch-icon.png', 'zenno-mark.svg', 'zenno-logo.svg'],
      manifest: {
        name: 'Zenno',
        short_name: 'Zenno',
        description: 'Bookings, customers, and revenue in one place.',
        // Owners install this to run bookings, QR gift-card redemption, etc.
        // as a full-screen app, so launch straight into the admin console.
        start_url: '/admin',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1A1714',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The page itself (index.html) always comes from the network when online, so
        // a deploy is visible on the next load; the cached copy is only an offline
        // fallback. Hashed JS/CSS files never change, so caching them is safe.
        globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages', networkTimeoutSeconds: 4 },
          },
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // The main bundle is ~2.3 MB (uncode-split). Raise the precache ceiling
        // so the app shell is fully cached. TODO: code-split to shrink this.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Supabase requests are cross-origin and are intentionally NOT cached,
        // so the app never serves stale bookings/gift-card data offline.
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
    // Pre-bundle Radix menus up front: discovering them mid-session re-optimizes
    // deps and can load two copies of React ("reading 'useState' of null").
    include: ['@radix-ui/react-dropdown-menu'],
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['.emergentagent.com', '.preview.emergentagent.com', 'localhost'],
  },
});
