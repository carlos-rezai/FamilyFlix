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
