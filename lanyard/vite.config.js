import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build jadi SATU file klasik (IIFE) bernama lanyard.js.
// Dengan begitu bisa dimuat lewat <script> biasa, termasuk saat index.html dibuka langsung dari file:// .
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: 'src/main.jsx',
      output: {
        format: 'iife',
        name: 'PortfolioLanyard',
        entryFileNames: 'lanyard.js',
        inlineDynamicImports: true,
      },
    },
  },
})
