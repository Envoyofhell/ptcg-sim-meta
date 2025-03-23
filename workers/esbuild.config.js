/** @type {import('esbuild').BuildOptions} */
module.exports = {
    entryPoints: ['index.js'],
    bundle: true,
    platform: 'node',
    target: ['es2020'],
    outfile: 'dist/worker.js',
    external: [
      '@neondatabase/serverless', 
      'itty-router'
    ],
    format: 'esm'
  };