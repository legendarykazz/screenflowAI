import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const desktopBuild = mode === 'desktop';

  return {
    plugins: [react()],
    base: desktopBuild ? './' : '/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist/app',
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      strictPort: true,
    },
  };
});
