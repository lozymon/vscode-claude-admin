const esbuild = require('esbuild');
const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

const ctx = esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: !isProduction,
  minify: isProduction,
});

ctx
  .then(async (c) => {
    if (isWatch) {
      await c.watch();
      console.log('Watching...');
    } else {
      await c.rebuild();
      await c.dispose();
      console.log('Build complete.');
    }
  })
  .catch(() => process.exit(1));
