// Builds the Desktop shell's two bundles with esbuild, through its API, both
// CJS: `main.js` (`package.json`'s `main`), `electron` external; and
// `server.js`, the **Server process** the installed shape forks,
// `better-sqlite3` external — its native binding cannot be bundled — and the
// dev library's `seriesSeed` kept out. Issues #216 and #220.
//
//   node electron/scripts/buildElectron.mjs            build once
//   node electron/scripts/buildElectron.mjs --outdir <dir>
//                                                      build once, elsewhere
//   node electron/scripts/buildElectron.mjs --watch    build, launch Electron,
//                                                      rebuild on change
//   node electron/scripts/buildElectron.mjs --start    build, launch Electron
//                                                      in the installed shape
//                                                      (FAMILYFLIX_SHELL_PROD=1)
//
// Electron is launched here, after the first build, rather than beside this
// script, so it never starts on a bundle that is not there yet. It is spawned
// by path with no shell (CLAUDE.md, "never use npx").

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { context } from 'esbuild';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const watch = args.includes('--watch');
const start = args.includes('--start');
const outdirAt = args.indexOf('--outdir');
const outdir =
  outdirAt >= 0 && outdirAt + 1 < args.length
    ? args[outdirAt + 1]
    : join(root, 'electron', 'dist');

/** Refuse the build if anything reaches the dev library's seed. */
const noSeriesSeed = {
  name: 'no-series-seed',
  setup(build) {
    build.onResolve({ filter: /seriesSeed/ }, (resolved) => ({
      errors: [
        {
          text: `seriesSeed is dev-only and never bundled (imported by ${resolved.importer})`,
        },
      ],
    }));
  },
};

const shared = {
  absWorkingDir: root,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info',
};

const contexts = await Promise.all([
  context({
    ...shared,
    entryPoints: ['electron/main.ts'],
    outfile: join(outdir, 'main.js'),
    external: ['electron'],
  }),
  context({
    ...shared,
    entryPoints: ['server/src/main.ts'],
    outfile: join(outdir, 'server.js'),
    external: ['better-sqlite3'],
    plugins: [noSeriesSeed],
  }),
]);

const disposeAll = () => Promise.all(contexts.map((ctx) => ctx.dispose()));

try {
  await Promise.all(contexts.map((ctx) => ctx.rebuild()));
} catch {
  await disposeAll();
  process.exit(1);
}

if (!watch && !start) {
  await disposeAll();
} else {
  if (watch) {
    await Promise.all(contexts.map((ctx) => ctx.watch()));
  } else {
    await disposeAll();
  }

  const electron = createRequire(import.meta.url)('electron');
  const shell = spawn(electron, ['.'], {
    cwd: root,
    env: start ? { ...process.env, FAMILYFLIX_SHELL_PROD: '1' } : process.env,
    stdio: 'inherit',
    shell: false,
  });

  // Closing the window ends the run, so `concurrently --kill-others` stops
  // Vite with it.
  shell.on('exit', async (code) => {
    if (watch) await disposeAll();
    process.exit(code ?? 0);
  });
}
