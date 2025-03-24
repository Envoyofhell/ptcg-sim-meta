const esbuild = require('esbuild');
const { parse } = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const isDebug = args.includes('--debug');

esbuild
  .build({
    entryPoints: ['index.js'],
    bundle: true,
    outfile: 'dist/worker.js',
    format: 'esm',
    external: [
      '@neondatabase/serverless', 
      'itty-router', 
      'zod'
    ],
    platform: 'browser',
    target: 'es2020',
    minify: !isDebug,
    sourcemap: isDebug,
    define: {
      'process.env.NODE_ENV': JSON.stringify(isDebug ? 'development' : 'production')
    },
    metafile: true,
    loader: {
      '.js': 'jsx',  // Support JSX in workers if needed
    }
  })
  .then(result => {
    // Optional: Log build details in debug mode
    if (isDebug) {
      console.log('Build metadata:', result.metafile);
    }
  })
  .catch((error) => {
    console.error('Build failed:', error);
    process.exit(1);
  });