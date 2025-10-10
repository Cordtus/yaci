import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5174,
    host: true
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'lit': ['lit']
        }
      }
    }
  }
})