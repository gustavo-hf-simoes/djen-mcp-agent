import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/djen': {
        target: 'https://comunicaapi.pje.jus.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/djen/, ''),
      },
    },
  },
})
