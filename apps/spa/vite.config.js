import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import yaml from '@rollup/plugin-yaml';

export default defineConfig({
  plugins: [svelte(), yaml()],
});
