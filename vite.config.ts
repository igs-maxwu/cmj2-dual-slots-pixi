import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '/cmj2-dual-slots-pixi/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
