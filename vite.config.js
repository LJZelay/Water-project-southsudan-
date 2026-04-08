import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base keeps deploy flexible for GitHub Pages project paths.
  base: './',
  build: {
    // Keep warning visible only for very large chunks after split.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) {
            return 'three';
          }
          return undefined;
        }
      }
    }
  }
});
