import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        css: 'injected'
      }
    })
  ],
  build: {
    lib: {
      entry: 'src/widget/index.js',
      name: 'NsiteDeployer',
      formats: ['iife', 'es'],
      fileName: (format) => format === 'es' ? 'deployer.mjs' : 'deployer.js'
    },
    outDir: 'dist',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
