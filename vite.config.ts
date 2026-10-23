import { defineConfig } from 'vite';

// Served from https://<user>.github.io/ant-game/ on GitHub Pages.
export default defineConfig({
  base: './',
  build: { target: 'es2020' },
});
