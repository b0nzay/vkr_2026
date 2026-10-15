import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        dashboard: 'src/main.jsx',
        client: 'src/clientMain.jsx',
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'dashboard') return 'assets/dashboard-main.js';
          if (chunkInfo.name === 'client') return 'assets/client-main.js';
          return 'assets/[name].js';
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});

