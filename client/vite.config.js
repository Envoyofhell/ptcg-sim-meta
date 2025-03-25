import { defineConfig, loadEnv } from 'vite';
import path from 'path';

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode`
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // Base path for the application
    base: '/',

    // Build configuration
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development', // Enable sourcemaps only in dev
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },
      },
    },

    // Resolve aliases for easier imports
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '~': path.resolve(__dirname, './node_modules'),
      },
    },

    // Environment variables handling
    define: {
      // Expose environment variables to the app
      'import.meta.env.VITE_APP_ENV': JSON.stringify(env.VITE_APP_ENV || mode),
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
    },

    // Development server configuration
    server: {
      port: 3000,
      strictPort: true,
      open: true,
      proxy: {
        // Optional: proxy API requests during development
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:4000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },

    // Environment variables configuration
    envDir: './',
    envPrefix: 'VITE_',
  };
});
