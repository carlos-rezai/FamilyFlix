// @vitest-environment node
//
// Issue #228 — the installed shape's paths. `shellPaths` is pure: from the
// **Shell mode** and Electron's three locations — `app.getAppPath()`,
// `process.resourcesPath` and `userData` — it answers every path the shell and
// the **Server process** need. Unpackaged (`dev`, `start`), `appPath` is the
// repo and every path is today's. Installed, the icon and both bundles come
// from `appPath` (`resources\app.asar`), and the renderer, the binding and
// `ffmpeg.exe` from `resourcesPath` — the **Packaged layout**. The server is
// forked in `userData`, because a working directory cannot be inside an asar.
//
// Main reads it once, beside `shellMode`, and stops reading `process.cwd()`.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { shellPaths } from './shellPaths';

const REPO = join('D:', 'repo');
const INSTALL = join(
  'C:',
  'Users',
  'someone',
  'AppData',
  'Local',
  'Programs',
  'FamilyFlix'
);
const RESOURCES = join(INSTALL, 'resources');
const ASAR = join(RESOURCES, 'app.asar');
const DEV_USER_DATA = join(
  'C:',
  'Users',
  'someone',
  'AppData',
  'Roaming',
  'FamilyFlix (dev)'
);
const USER_DATA = join(
  'C:',
  'Users',
  'someone',
  'AppData',
  'Roaming',
  'FamilyFlix'
);

/** Unpackaged, Electron's resources are its own, under node_modules. */
const ELECTRON_RESOURCES = join(
  REPO,
  'node_modules',
  'electron',
  'dist',
  'resources'
);

describe.each(['dev', 'start'] as const)(
  'shellPaths — %s (an Unpackaged run)',
  (mode) => {
    const paths = () =>
      shellPaths(mode, {
        appPath: REPO,
        resourcesPath: ELECTRON_RESOURCES,
        userData: DEV_USER_DATA,
      });

    it('answers the repo as the app', () => {
      expect(paths().app).toBe(REPO);
    });

    it('finds the App mark under electron/assets', () => {
      expect(paths().icon).toBe(join(REPO, 'electron', 'assets', 'icon.ico'));
    });

    it('forks the bundle buildElectron.mjs writes', () => {
      expect(paths().serverEntry).toBe(
        join(REPO, 'electron', 'dist', 'server.js')
      );
    });

    it('serves the renderer Vite builds into dist/familyflix', () => {
      expect(paths().renderer).toBe(join(REPO, 'dist', 'familyflix'));
    });

    it('loads the Electron-ABI binding electron:native fetched', () => {
      expect(paths().sqliteBinding).toBe(
        join(REPO, 'electron', '.native', 'better_sqlite3.node')
      );
    });

    it('carries no FFmpeg, so PATH stands in', () => {
      expect(paths().ffmpeg).toBeNull();
    });

    it('forks the server in the repo, so its own library is used', () => {
      expect(paths().serverCwd).toBe(REPO);
    });

    it('reads nothing under resourcesPath or userData', () => {
      const values = Object.values(paths()).filter(
        (value): value is string => typeof value === 'string'
      );

      for (const value of values) {
        expect(value.startsWith(ELECTRON_RESOURCES)).toBe(false);
        expect(value.startsWith(DEV_USER_DATA)).toBe(false);
      }
    });
  }
);

describe('shellPaths — installed (the Packaged layout)', () => {
  const paths = () =>
    shellPaths('installed', {
      appPath: ASAR,
      resourcesPath: RESOURCES,
      userData: USER_DATA,
    });

  it('answers app.asar as the app', () => {
    expect(paths().app).toBe(ASAR);
  });

  it('finds the App mark inside app.asar', () => {
    expect(paths().icon).toBe(join(ASAR, 'electron', 'assets', 'icon.ico'));
  });

  it('forks the server bundle inside app.asar', () => {
    expect(paths().serverEntry).toBe(
      join(ASAR, 'electron', 'dist', 'server.js')
    );
  });

  it('serves the renderer from resources\\renderer, outside the asar', () => {
    expect(paths().renderer).toBe(join(RESOURCES, 'renderer'));
  });

  it('loads the binding from resources\\native, outside the asar', () => {
    expect(paths().sqliteBinding).toBe(
      join(RESOURCES, 'native', 'better_sqlite3.node')
    );
  });

  it('carries the Default component’s ffmpeg.exe under resources\\ffmpeg', () => {
    expect(paths().ffmpeg).toBe(join(RESOURCES, 'ffmpeg', 'ffmpeg.exe'));
  });

  it('forks the server in userData, never inside the asar', () => {
    expect(paths().serverCwd).toBe(USER_DATA);
  });
});

/** `electron/main.ts` with its comments stripped, so prose cannot satisfy a check. */
function mainSource(): string {
  return readFileSync(
    fileURLToPath(new URL('../main.ts', import.meta.url)),
    'utf8'
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('main reads its paths from shellPaths', () => {
  it('no longer reads process.cwd()', () => {
    expect(mainSource()).not.toMatch(/process\.cwd\s*\(/);
  });

  it('has no ICON constant', () => {
    expect(mainSource()).not.toMatch(/\bconst\s+ICON\b/);
  });

  it('imports shellPaths from its unit', () => {
    expect(mainSource()).toMatch(
      /import\s*\{[^}]*\bshellPaths\b[^}]*\}\s*from\s*['"]\.\/shellPaths\/shellPaths['"]/
    );
  });

  it('gives the window paths.icon and the fork paths.serverCwd', () => {
    const source = mainSource();

    expect(source).toMatch(/icon:\s*paths\.icon\b/);
    expect(source).toMatch(/cwd:\s*paths\.serverCwd\b/);
  });
});
