import { defineConfig } from 'vite';
import { createServerApp } from './server/index.js';

function aiBackendPlugin() {
  const { app } = createServerApp();
  return {
    name: 'ai-backend-plugin',
    configureServer(server) {
      server.middlewares.use(app);
    },
  };
}

export default defineConfig({
  plugins: [aiBackendPlugin()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
