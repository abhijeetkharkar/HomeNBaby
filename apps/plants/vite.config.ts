import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/plants': {
        target: 'https://plants.abhijeetkharkar.com',
        changeOrigin: true,
      },
    },
  },
})
