import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use relative asset URLs in production so the site works from GitHub Pages,
// a custom domain, or any other static host without path-specific rewrites.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [react()],
}))
