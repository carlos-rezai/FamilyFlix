// `npm run electron:package` — the **Installer**. Issue #230.
//
//   node electron/scripts/packageApp.mjs          release/FamilyFlix-Setup-<version>.exe
//   node electron/scripts/packageApp.mjs --dir    release/win-unpacked/ only
//
// The chain: `nx build` (the renderer) → `buildElectron.mjs` (the two
// bundles) → `fetchNative.mjs` (the Electron-ABI binding) → `fetchFfmpeg.mjs`
// (the **Default component**, issue #231) → electron-builder's
// `build()` over `electron/packaging/builderConfig.json`, NSIS x64, never
// published. Every step is run by path with no shell (CLAUDE.md, "never use
// npx"); no typecheck and no tests run here. The Electron runtime packaged is
// the installed `electron` version — the one `fetchNative.mjs` fetched the
// binding for.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import builder from 'electron-builder';

const { Arch, Platform, build } = builder;

const root = fileURLToPath(new URL('../..', import.meta.url));
const dir = process.argv.slice(2).includes('--dir');

/** Run one step of the chain with Node, by path, and stop the chain on failure. */
function step(script, args = []) {
  const result = spawnSync(process.execPath, [join(root, script), ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

step('node_modules/nx/dist/bin/nx.js', ['build']);
step('electron/scripts/buildElectron.mjs');
step('electron/scripts/fetchNative.mjs');
step('electron/scripts/fetchFfmpeg.mjs');

const readJson = (relative) =>
  JSON.parse(readFileSync(join(root, relative), 'utf8'));

const config = {
  ...readJson('electron/packaging/builderConfig.json'),
  electronVersion: readJson('node_modules/electron/package.json').version,
};

try {
  await build({
    projectDir: root,
    config,
    publish: 'never',
    targets: Platform.WINDOWS.createTarget(dir ? 'dir' : 'nsis', Arch.x64),
  });
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
  process.exit(1);
}
