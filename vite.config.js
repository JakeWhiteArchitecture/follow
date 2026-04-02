import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === 'singlefile' ? [viteSingleFile()] : []),
  ],
  server: {
    port: 3000,
  },
  build: {
    ...(mode === 'singlefile' ? { outDir: 'dist-single' } : {}),
  },
}));
