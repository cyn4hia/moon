import { defineConfig } from 'vite'

// base './' keeps asset URLs relative so the build works on GitHub Pages
// (served from /<repo>/) without any extra configuration.
export default defineConfig({
  base: './',
})
