// Builds the Desktop shell's main process with esbuild, through its API: one
// CJS bundle at `electron/dist/main.js` (`package.json`'s `main`), `electron`
// external. Issue #216.
//
//   node electron/scripts/buildElectron.mjs            build once
//   node electron/scripts/buildElectron.mjs --watch    build, launch Electron,
//                                                      rebuild on change
//
// Electron is launched here, after the first build, rather than beside this
// script, so it never starts on a bundle that is not there yet. It is spawned
// by path with no shell (CLAUDE.md, "never use npx").

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { context } from 'esbuild';

const root = fileURLToPath(new URL('../..', import.meta.url));
const watch = process.argv.includes('--watch');

const ctx = await context({
  absWorkingDir: root,
  entryPoints: ['electron/main.ts'],
  outfile: 'electron/dist/main.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  sourcemap: true,
  external: ['electron'],
  logLevel: 'info',
});

if (!watch) {
  await ctx.rebuild();
  await ctx.dispose();
} else {
  await ctx.rebuild();
  await ctx.watch();

  const electron = createRequire(import.meta.url)('electron');
  const shell = spawn(electron, ['.'], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });

  // Closing the window ends the run, so `concurrently --kill-others` stops
  // Vite with it.
  shell.on('exit', async (code) => {
    await ctx.dispose();
    process.exit(code ?? 0);
  });
}
