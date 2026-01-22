import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [preact(), tailwindcss()],
  build: {
    outDir: '../static/dist',
    emptyDirBeforeWrite: true,
    rollupOptions: {
      output: {
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'css/[name][extname]'
          }
          return 'assets/[name][extname]'
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5001',
      '/auth': 'http://localhost:5001'
    }
  }
})
