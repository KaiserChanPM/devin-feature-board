import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig(({ mode }) => {
  // PORT is the backend's port, read from the real environment or the root .env.
  const { PORT } = loadEnv(mode, repoRoot, '');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': `http://localhost:${PORT || 3001}`,
      },
    },
  };
});
