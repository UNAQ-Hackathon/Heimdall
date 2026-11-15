import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const { VITE_API_PROXY_TARGET } = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      fs: {
        allow: [searchForWorkspaceRoot(process.cwd()), fileURLToPath(new URL('../assets3d', import.meta.url))],
      },
      proxy: {
        '/api': VITE_API_PROXY_TARGET || 'http://localhost:5000',
      },
    },
  };
});
