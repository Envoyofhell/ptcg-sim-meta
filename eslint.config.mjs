// ESM version of esbuild.config.js
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDebug = process.argv.includes('--debug');

// Configure the build
const buildOptions = {
  entryPoints: ['./index.js'],
  bundle: true,
  minify: !isDebug,
  sourcemap: isDebug ? 'inline' : false,
  target: ['es2020'],
  format: 'esm',
  outfile: './dist/worker.js',
  define: {
    'process.env.NODE_ENV': isDebug ? '"development"' : '"production"'
  },
  logLevel: 'info',
};

console.log(`Building worker in ${isDebug ? 'debug' : 'production'} mode...`);

try {
  await build(buildOptions);
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}