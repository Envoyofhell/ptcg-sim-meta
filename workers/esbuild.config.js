// esbuild.config.js
const esbuild = require('esbuild');
const path = require('path');

async function build() {
  try {
    await esbuild.build({
      entryPoints: ['index.js'],
      bundle: true,
      platform: 'node',
      target: ['es2020'],
      outfile: 'dist/worker.js',
      external: [
        '@neondatabase/serverless', 
        'itty-router'
      ],
      format: 'esm',
      logLevel: 'info'
    });
    console.log('Build successful!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();