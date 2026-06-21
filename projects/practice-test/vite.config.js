import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'app',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'manifest.webmanifest', 'icons.svg'],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,json,woff2}'],
        // Hash-router SPA — no document navigations; absolute /index.html breaks on GitHub Pages subpaths.
        navigateFallback: null,
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
