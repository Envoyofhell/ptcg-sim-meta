// workers/esbuild.config.js
const esbuild = require('esbuild');

esbuild
  .build({
    entryPoints: ['index.js'],
    bundle: true,
    outfile: 'dist/worker.js',
    format: 'esm',
    external: ['@neondatabase/serverless', 'itty-router'],
    platform: 'browser',
    target: 'es2020',
    minify: false,
    sourcemap: true,
  })
  .catch((error) => {
    console.error('Build failed:', error);
    process.exit(1);
  });
