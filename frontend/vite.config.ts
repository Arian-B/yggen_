import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'print-arango-url',
      configureServer(server) {
        const arangoUrl = process.env.VITE_ARANGO_URL || 'http://localhost:8529';
        server.httpServer?.once('listening', () => {
          setTimeout(() => {
            console.log(`\n  ➜  ArangoDB UI: \x1b[36m${arangoUrl}\x1b[0m\n`);
          }, 100);
        });
      }
    }
  ],
  server: {
    open: true,
    port: 5173,
  }
})
