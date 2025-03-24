// Simple ESM version of esbuild.config.js
import * as esbuild from 'esbuild';

try {
  console.log('Building workers...');
  
  const result = await esbuild.build({
    entryPoints: ['./index.js'],
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2020',
    outfile: './dist/worker.js',
    define: {
      'process.env.NODE_ENV': '"production"'
    }
  });
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}