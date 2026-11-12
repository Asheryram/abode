import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Bind on all interfaces so a phone on the same wifi can open the dev server.
    host: true,
    port: 5180,
  },
  preview: {
    host: true,
    port: 5180,
  },
})
