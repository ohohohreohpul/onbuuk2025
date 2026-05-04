import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * WordPress build configuration.
 * Produces wp-plugin/assets/buuk-booking.js and wp-plugin/assets/buuk-booking.css.
 * Run with: npm run build:wp
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'wp-plugin/assets',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/wp-entry.tsx'),
      output: {
        format: 'iife',
        // Single bundle — no hashed filenames so the PHP plugin can hardcode them
        entryFileNames: 'buuk-booking.js',
        chunkFileNames: 'buuk-booking-[name].js',
        assetFileNames: 'buuk-booking.[ext]',
        // Required for IIFE format when there are internal chunks
        inlineDynamicImports: true,
      },
    },
  },
});
