import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (/[\\/]src[\\/]components[\\/]modals[\\/]/.test(id)) return 'management-modals';
              if (!id.includes('node_modules')) return undefined;
              if (/[\\/]node_modules[\\/](firebase|@firebase)[\\/]firestore[\\/]/.test(id)) return 'firebase-firestore';
              if (/[\\/]node_modules[\\/](firebase|@firebase)[\\/]auth[\\/]/.test(id)) return 'firebase-auth';
              if (/[\\/]node_modules[\\/](firebase|@firebase)[\\/]/.test(id)) return 'firebase-core';
              if (/[\\/]node_modules[\\/]pdfjs-dist[\\/]/.test(id)) return 'pdf';
              if (/[\\/]node_modules[\\/](react|react-dom|scheduler|motion)[\\/]/.test(id)) return 'react-vendor';
              if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) return 'icons';
              if (/[\\/]node_modules[\\/](dompurify|marked|react-markdown|remark-breaks|remark-gfm)[\\/]/.test(id)) return 'markdown';
              if (/[\\/]node_modules[\\/](qrcode\.react|qrcode-generator|uuid)[\\/]/.test(id)) return 'utility-vendor';
              return undefined;
            },
          },
        },
      },
});
