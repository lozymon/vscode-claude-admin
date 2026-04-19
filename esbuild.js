const esbuild = require('esbuild');
const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

const sharedOpts = {
  bundle: true,
  sourcemap: !isProduction,
  minify: isProduction,
};

async function build() {
  const ext = await esbuild.context({
    ...sharedOpts,
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
  });

  const cm = await esbuild.context({
    ...sharedOpts,
    entryPoints: ['src/webview/ui/cm-entry.js'],
    outfile: 'src/webview/ui/cm-bundle.js',
    format: 'iife',
    globalName: 'CM',
    platform: 'browser',
  });

  if (isWatch) {
    await Promise.all([ext.watch(), cm.watch()]);
    console.log('Watching...');
  } else {
    await ext.rebuild();
    await ext.dispose();
    await cm.rebuild();
    await cm.dispose();
    console.log('Build complete.');
  }
}

build().catch(() => process.exit(1));
