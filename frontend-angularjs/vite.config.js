import { defineConfig } from 'vite';

const host = process.env.BACKEND_HOST || '127.0.0.1';
const port = Number(process.env.BACKEND_PORT || 8888);

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: Number(process.env.FRONTEND_PORT || 8080),
    strictPort: true,
    proxy: {
      '/api': { target: `http://${host}:${port}`, changeOrigin: true },
    },
  },
});
