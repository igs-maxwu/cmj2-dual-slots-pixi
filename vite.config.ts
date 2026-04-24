import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  base: '/cmj2-dual-slots-pixi/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'assets/**/*'],
      manifest: {
        name: '雀靈戰記 · Dual Slots',
        short_name: '雀靈戰記',
        description: '1v1 mahjong-fantasy slot battle',
        theme_color: '#0a0e1a',
        background_color: '#0a0e1a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/cmj2-dual-slots-pixi/',
        start_url: '/cmj2-dual-slots-pixi/',
        icons: [
          {
            src: 'assets/ui/pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'assets/ui/pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'assets/ui/pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache all .webp / .webmanifest / .js / .css / audio files for offline
        globPatterns: ['**/*.{js,css,html,webp,webmanifest,mp3,atlas}'],
        // Large assets — audio BGM runtime cache instead of precache
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
});
