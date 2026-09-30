// @vitest-environment node
//
// Issue #216 — the window over the server. `serverLaunch` is pure: from
// `(isPackaged, prodFlag, userData, cwd)` it answers what main hands
// `utilityProcess.fork()` — the entry, the execArgv and the environment the
// **Server process** starts under.
//
// This slice covers the dev combination only (unpackaged, no
// `FAMILYFLIX_SHELL_PROD`): the server forked from source through tsx on
// `3001`, pointed at the Electron-ABI `better-sqlite3` binding that
// `electron:native` fetched, and — because an unpackaged run uses the repo's
// own `./familyflix.db`, `./media` and `./playback-component` — none of the
// three path variables set.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { serverLaunch } from './serverLaunch';

const CWD = join('D:', 'repo');
const USER_DATA = join(
  'C:',
  'Users',
  'someone',
  'AppData',
  'Roaming',
  'FamilyFlix (dev)'
);

const dev = () => serverLaunch(false, false, USER_DATA, CWD);

describe('serverLaunch — the dev combination', () => {
  it('forks the server from its source entry', () => {
    expect(dev().entry).toBe(join(CWD, 'server', 'src', 'main.ts'));
  });

  it('runs the source through tsx with --import tsx', () => {
    expect(dev().execArgv).toEqual(['--import', 'tsx']);
  });

  it('listens on 3001, the port Vite proxies to', () => {
    expect(dev().env.PORT).toBe('3001');
  });

  it('points the SQLite binding at the Electron-ABI prebuild under electron/.native', () => {
    const binding = dev().env.FAMILYFLIX_SQLITE_BINDING;

    expect(binding).toBeDefined();
    expect(binding?.startsWith(join(CWD, 'electron', '.native'))).toBe(true);
    expect(binding?.endsWith('better_sqlite3.node')).toBe(true);
  });

  it.each([
    'FAMILYFLIX_DB_PATH',
    'FAMILYFLIX_MEDIA_PATH',
    'FAMILYFLIX_COMPONENT_PATH',
  ])('leaves %s unset, so the repo-local default is used', (name) => {
    expect(dev().env).not.toHaveProperty(name);
  });
});

// Issue #220 — the installed shape. `serverLaunch` learns the other two
// combinations. `FAMILYFLIX_SHELL_PROD` (`electron:start`) runs the installed
// shape unpackaged: the bundled server, no tsx, the **Shell port** `41720`, the
// built renderer — but still the repo's own library and the Electron-ABI
// binding `electron:native` fetched. Packaged, the three path variables go
// under `userData` (`%APPDATA%\FamilyFlix\`), the **Trusted hosts** are set
// empty, and the package's own binding is used.

const PACKAGED_USER_DATA = join(
  'C:',
  'Users',
  'someone',
  'AppData',
  'Roaming',
  'FamilyFlix'
);

const BUNDLED_SERVER = join(CWD, 'electron', 'dist', 'server.js');
const BUILT_RENDERER = join(CWD, 'dist', 'familyflix');

describe('serverLaunch — the dev combination, the installed shape’s variables', () => {
  it('sets no renderer path, so Vite serves the renderer', () => {
    expect(dev().env).not.toHaveProperty('FAMILYFLIX_RENDERER_PATH');
  });

  it('leaves the trusted hosts to their default, which admits Vite', () => {
    expect(dev().env).not.toHaveProperty('FAMILYFLIX_TRUSTED_HOSTS');
  });
});

describe('serverLaunch — the prod flag, unpackaged (electron:start)', () => {
  const prod = () => serverLaunch(false, true, USER_DATA, CWD);

  it('forks the bundled server', () => {
    expect(prod().entry).toBe(BUNDLED_SERVER);
  });

  it('passes no --import tsx', () => {
    expect(prod().execArgv).toEqual([]);
  });

  it('listens on the Shell port 41720', () => {
    expect(prod().env.PORT).toBe('41720');
  });

  it('serves the built renderer', () => {
    expect(prod().env.FAMILYFLIX_RENDERER_PATH).toBe(BUILT_RENDERER);
  });

  it('still points the SQLite binding at the Electron-ABI prebuild', () => {
    expect(prod().env.FAMILYFLIX_SQLITE_BINDING).toBe(
      join(CWD, 'electron', '.native', 'better_sqlite3.node')
    );
  });

  it('leaves the trusted hosts to their default', () => {
    expect(prod().env).not.toHaveProperty('FAMILYFLIX_TRUSTED_HOSTS');
  });

  it.each([
    'FAMILYFLIX_DB_PATH',
    'FAMILYFLIX_MEDIA_PATH',
    'FAMILYFLIX_COMPONENT_PATH',
  ])('leaves %s unset, so the repo’s own library is used', (name) => {
    expect(prod().env).not.toHaveProperty(name);
  });
});

describe.each([
  ['without the prod flag', false],
  ['with the prod flag', true],
])('serverLaunch — packaged, %s', (_label, prodFlag) => {
  const packaged = () => serverLaunch(true, prodFlag, PACKAGED_USER_DATA, CWD);

  it('forks the bundled server', () => {
    expect(packaged().entry).toBe(BUNDLED_SERVER);
  });

  it('passes no --import tsx', () => {
    expect(packaged().execArgv).toEqual([]);
  });

  it('listens on the Shell port 41720', () => {
    expect(packaged().env.PORT).toBe('41720');
  });

  it('serves the built renderer', () => {
    expect(packaged().env.FAMILYFLIX_RENDERER_PATH).toBe(BUILT_RENDERER);
  });

  it('puts the database under userData', () => {
    expect(packaged().env.FAMILYFLIX_DB_PATH).toBe(
      join(PACKAGED_USER_DATA, 'familyflix.db')
    );
  });

  it('puts the managed media directory under userData', () => {
    expect(packaged().env.FAMILYFLIX_MEDIA_PATH).toBe(
      join(PACKAGED_USER_DATA, 'media')
    );
  });

  it('puts the Component slot under userData', () => {
    expect(packaged().env.FAMILYFLIX_COMPONENT_PATH).toBe(
      join(PACKAGED_USER_DATA, 'playback-component')
    );
  });

  it('sets the trusted hosts empty', () => {
    expect(packaged().env.FAMILYFLIX_TRUSTED_HOSTS).toBe('');
  });

  it('leaves the SQLite binding to the package’s own', () => {
    expect(packaged().env).not.toHaveProperty('FAMILYFLIX_SQLITE_BINDING');
  });
});
