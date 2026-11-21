import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';

const rootDir = process.cwd();
const apiDir = path.join(rootDir, 'api');
const entryFile = path.join(rootDir, 'server', 'app.ts');
const outFile = path.join(apiDir, 'index.js');

fs.mkdirSync(apiDir, { recursive: true });

// Remove any extra files inside /api so Vercel creates strictly ONE serverless function
for (const entry of fs.readdirSync(apiDir)) {
  if (entry !== 'index.js') {
    fs.rmSync(path.join(apiDir, entry), { recursive: true, force: true });
  }
}

const result = await esbuild.build({
  entryPoints: [entryFile],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  packages: 'external',
  keepNames: true,
  minify: false,
  logLevel: 'info',
  banner: {
    js: '// Self-contained ESM bundle built by scripts/build-api.mjs from server/app.ts\n',
  },
});

if (result.errors.length > 0) {
  console.error('[build-api] Build failed with errors:', result.errors);
  process.exit(1);
}

const apiFiles = fs.readdirSync(apiDir);
if (apiFiles.length !== 1 || apiFiles[0] !== 'index.js') {
  console.error('[build-api] Expected strictly one file (index.js) in api/, found:', apiFiles);
  process.exit(1);
}

const stats = fs.statSync(outFile);
console.log(
  `[build-api] Built self-contained ESM bundle api/index.js (${(stats.size / 1024).toFixed(1)} KB); api/ files: ${apiFiles.join(', ')}`
);
