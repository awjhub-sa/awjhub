import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  optimizeDeps: {
    /* pdf.js is left out of dependency pre-bundling.
     *
     * It ships as a single ES module that already carries its own worker
     * reference, and running it through the pre-bundler both gains nothing and
     * breaks that reference. It also fails in a way that reads as a code bug
     * rather than a cache one: a dev server started before the package was
     * installed keeps serving a dependency graph without it, and the dynamic
     * import dies with "Failed to fetch dynamically imported module" pointing
     * at a .vite/deps path that was never written.
     *
     * Excluding it means the browser loads pdf.mjs directly — no cache to go
     * stale, and nothing to re-optimise when the package version changes. */
    exclude: ['pdfjs-dist'],
  },
})
