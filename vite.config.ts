import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { cloudflare } from "@cloudflare/vite-plugin";

// A chave do Gemini fica só no Cloudflare Worker (proxy) — nunca no bundle.
export default defineConfig(() => {
  return {
    base: '/housefinance/',
    plugins: [react(), tailwindcss(), cloudflare()],
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          // Bibliotecas em chunks próprios: mudam pouco entre deploys,
          // então continuam no cache do navegador/service worker.
          manualChunks: {
            react:    ['react', 'react-dom', 'react-router-dom'],
            supabase: ['@supabase/supabase-js'],
            motion:   ['motion/react'],
          },
        },
      },
    },
  };
});