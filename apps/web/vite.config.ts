import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '../..'),
  resolve: {
    alias: {
      '@ragdocs/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@ragdocs/sdk': path.resolve(__dirname, '../../packages/sdk/src')
    }
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '../..')]
    }
  }
});
