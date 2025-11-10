import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Get API server URL from environment variable, default to localhost for local dev
const apiServerUrl = process.env.VITE_API_URL || process.env.API_URL || 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: apiServerUrl,
        changeOrigin: true,
        secure: true, // Set to false if using self-signed certificates
      },
    },
  },
})
