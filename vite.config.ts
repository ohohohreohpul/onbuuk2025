import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'iconobrowser.png'],
      manifest: {
        name: 'Buuk',
        short_name: 'Buuk',
        description: 'Bookings, gift cards, and business management',
        // Owners install this to run bookings, QR gift-card redemption, etc.
        // as a full-screen app, so launch straight into the admin console.
        start_url: '/admin',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#008374',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the built app shell; SPA navigations fall back to index.html.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
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
  },
  resolve: {
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
