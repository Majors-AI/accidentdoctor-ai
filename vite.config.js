import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Plain Vite config: React plugin + explicit '@' -> src alias.
// No @base44/vite-plugin / SDK build-time plugin — the @base44/sdk npm
// package stays installed so page imports resolve at runtime.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
