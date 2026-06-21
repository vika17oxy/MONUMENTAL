import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // LAN dev server behind the firewall — allow any host so mDNS names like
    // monumental.local / L1TE03.local work (Vite 5.4 blocks unknown hosts).
    allowedHosts: true,
  },
});
