import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: '@nsite/stealthis',
      formats: ['iife', 'es'],
      fileName: (format) => (format === 'es' ? 'stealthis.mjs' : 'stealthis.js')
    },
    outDir: 'dist'
  }
});
