import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base keeps deploy flexible for GitHub Pages project paths.
  base: './',
  build: {
    // Build as an MPA so each root HTML file is emitted to dist/.
    rollupOptions: {
      input: {
        main: 'index.html',
        experience: 'experience.html',
        comingSoon: 'coming-soon.html',
        closing: 'closing.html'
      },
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) {
            return 'three';
          }
          return undefined;
        }
      }
    },
    // Keep warning visible only for very large chunks after split.
    chunkSizeWarningLimit: 700
  }
});
