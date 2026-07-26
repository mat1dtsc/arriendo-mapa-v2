import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxy = { '/api': 'http://localhost:3000' };

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
  build: { chunkSizeWarningLimit: 1200 },
});
