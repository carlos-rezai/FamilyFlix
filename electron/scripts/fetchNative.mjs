// `npm run electron:native` — fetch the Electron-ABI prebuild of
// `better-sqlite3` into the gitignored `electron/.native/`. Issue #216.
//
// The server runs on Electron's own Node under the shell, whose ABI the
// package's own binding does not match. Rebuilding in place would turn Vitest,
// on Node's ABI, red — so the Electron binding lives beside the package
// instead, and main points `FAMILYFLIX_SQLITE_BINDING` at it.
//
// prebuild-install (better-sqlite3's own installer) is run by path with no
// shell, in a staging directory holding a copy of the package's manifest.

import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const modules = join(root, 'node_modules');
const { version: electronVersion } = JSON.parse(
  readFileSync(join(modules, 'electron', 'package.json'), 'utf8')
);

const staging = mkdtempSync(join(tmpdir(), 'familyflix-native-'));
try {
  copyFileSync(
    join(modules, 'better-sqlite3', 'package.json'),
    join(staging, 'package.json')
  );

  const result = spawnSync(
    process.execPath,
    [
      join(modules, 'prebuild-install', 'bin.js'),
      '--runtime',
      'electron',
      '--target',
      electronVersion,
      '--arch',
      process.arch,
      '--platform',
      process.platform,
      '--verbose',
    ],
    { cwd: staging, stdio: 'inherit', shell: false }
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const native = join(root, 'electron', '.native');
  mkdirSync(native, { recursive: true });
  copyFileSync(
    join(staging, 'build', 'Release', 'better_sqlite3.node'),
    join(native, 'better_sqlite3.node')
  );
  process.stdout.write(
    `better-sqlite3 for Electron ${electronVersion} → electron/.native\n`
  );
} finally {
  rmSync(staging, { recursive: true, force: true });
}
