import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(directory, 'src', 'renderer'),
  publicDir: path.join(directory, 'public'),
  base: './',
  plugins: [react()],
  build: { outDir: path.join(directory, 'dist', 'renderer'), emptyOutDir: true }
});
