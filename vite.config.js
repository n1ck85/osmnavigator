import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      leaflet: '/node_modules/leaflet/dist/leaflet.js',
    }
  }
})
