// @vitest-environment node
//
// Issue #216 — the window over the server. `serverLaunch` is pure: from
// `(mode, userData, cwd)` — the **Shell mode**, since issue #226 — it answers
// what main hands `utilityProcess.fork()`: the entry and the environment the
// **Server process** starts under.
//
// This slice covers the `'dev'` mode only (`electron:dev`): since issue #226
// the bundle the watcher builds, the one fork path every mode shares, on
// `3001`, pointed at the Electron-ABI `better-sqlite3` binding that
// `electron:native` fetched, and — because an unpackaged run uses the repo's
// own `./familyflix.db`, `./media` and `./playback-component` — none of the
// three path variables set.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ShellPaths } from '../shellPaths/shellPaths';
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

// Issue #228 — `serverLaunch(mode, userData, cwd)` became
// `serverLaunch(mode, userData, paths)`: every path it hands the fork is one
// `shellPaths` answered. These are the unpackaged ones, today's under the repo.
const UNPACKAGED: ShellPaths = {
  icon: join(CWD, 'electron', 'assets', 'icon.ico'),
  serverEntry: join(CWD, 'electron', 'dist', 'server.js'),
  renderer: join(CWD, 'dist', 'familyflix'),
  sqliteBinding: join(CWD, 'electron', '.native', 'better_sqlite3.node'),
  ffmpeg: null,
  serverCwd: CWD,
};

const dev = () => serverLaunch('dev', USER_DATA, UNPACKAGED);

describe('serverLaunch — dev (electron:dev)', () => {
  it('forks the bundle the watcher builds', () => {
    expect(dev().entry).toBe(join(CWD, 'electron', 'dist', 'server.js'));
  });

  it('passes no Node flags', () => {
    expect(dev()).not.toHaveProperty('execArgv');
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
// modes. `'start'` (`electron:start`) runs the installed shape unpackaged: the bundled server, no tsx, the **Shell port** `41720`, the
// built renderer — but still the repo's own library and the Electron-ABI
// binding `electron:native` fetched. `'installed'`, the three path variables go
// under `userData` (`%APPDATA%\FamilyFlix\`), the **Trusted hosts** are set
// empty, and (since issue #228) the binding is the one under `resources\native`.

const PACKAGED_USER_DATA = join(
  'C:',
  'Users',
  'someone',
  'AppData',
  'Roaming',
  'FamilyFlix'
);

// Issue #228 — the **Packaged layout**: the bundles inside `app.asar`, the
// renderer and the binding beside it under `resources`. Distinct from the
// repo's, so an entry or a renderer path not read off `ShellPaths` shows.
const RESOURCES = join('C:', 'Programs', 'FamilyFlix', 'resources');
const ASAR = join(RESOURCES, 'app.asar');
const INSTALLED: ShellPaths = {
  icon: join(ASAR, 'electron', 'assets', 'icon.ico'),
  serverEntry: join(ASAR, 'electron', 'dist', 'server.js'),
  renderer: join(RESOURCES, 'renderer'),
  sqliteBinding: join(RESOURCES, 'native', 'better_sqlite3.node'),
  ffmpeg: join(RESOURCES, 'ffmpeg', 'ffmpeg.exe'),
  serverCwd: PACKAGED_USER_DATA,
};

const BUNDLED_SERVER = join(CWD, 'electron', 'dist', 'server.js');
const BUILT_RENDERER = join(CWD, 'dist', 'familyflix');

describe('serverLaunch — dev, the installed shape’s variables', () => {
  it('sets no renderer path, so Vite serves the renderer', () => {
    expect(dev().env).not.toHaveProperty('FAMILYFLIX_RENDERER_PATH');
  });

  it('leaves the trusted hosts to their default, which admits Vite', () => {
    expect(dev().env).not.toHaveProperty('FAMILYFLIX_TRUSTED_HOSTS');
  });
});

describe('serverLaunch — start (electron:start)', () => {
  const prod = () => serverLaunch('start', USER_DATA, UNPACKAGED);

  it('forks the bundled server', () => {
    expect(prod().entry).toBe(BUNDLED_SERVER);
  });

  it('passes no --import tsx', () => {
    expect(prod()).not.toHaveProperty('execArgv');
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

describe('serverLaunch — installed (the Installed app)', () => {
  const packaged = () =>
    serverLaunch('installed', PACKAGED_USER_DATA, INSTALLED);

  it('forks the server bundle shellPaths finds inside app.asar', () => {
    expect(packaged().entry).toBe(INSTALLED.serverEntry);
  });

  it('passes no --import tsx', () => {
    expect(packaged()).not.toHaveProperty('execArgv');
  });

  it('listens on the Shell port 41720', () => {
    expect(packaged().env.PORT).toBe('41720');
  });

  it('serves the renderer shellPaths finds under resources', () => {
    expect(packaged().env.FAMILYFLIX_RENDERER_PATH).toBe(INSTALLED.renderer);
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

  it('points the SQLite binding at resources\\native, from ShellPaths', () => {
    expect(packaged().env.FAMILYFLIX_SQLITE_BINDING).toBe(
      INSTALLED.sqliteBinding
    );
  });
});

// Issue #228 — the entry and the renderer are read off `ShellPaths` in every
// mode, never joined from a working directory. A `ShellPaths` whose paths share
// no root with the repo's proves it.
describe('serverLaunch — every path from ShellPaths', () => {
  const ELSEWHERE = join('E:', 'elsewhere');
  const paths: ShellPaths = {
    icon: join(ELSEWHERE, 'mark.ico'),
    serverEntry: join(ELSEWHERE, 'bundles', 'the-server.js'),
    renderer: join(ELSEWHERE, 'the-renderer'),
    sqliteBinding: join(ELSEWHERE, 'abi', 'binding.node'),
    ffmpeg: null,
    serverCwd: ELSEWHERE,
  };

  it.each(['dev', 'start', 'installed'] as const)(
    '%s forks paths.serverEntry',
    (mode) => {
      expect(serverLaunch(mode, PACKAGED_USER_DATA, paths).entry).toBe(
        paths.serverEntry
      );
    }
  );

  it.each(['start', 'installed'] as const)(
    '%s serves paths.renderer',
    (mode) => {
      expect(
        serverLaunch(mode, PACKAGED_USER_DATA, paths).env
          .FAMILYFLIX_RENDERER_PATH
      ).toBe(paths.renderer);
    }
  );

  it.each(['dev', 'start', 'installed'] as const)(
    '%s points the SQLite binding at paths.sqliteBinding',
    (mode) => {
      expect(
        serverLaunch(mode, PACKAGED_USER_DATA, paths).env
          .FAMILYFLIX_SQLITE_BINDING
      ).toBe(paths.sqliteBinding);
    }
  );
});

// Issue #231 — FFmpeg on board. The **Installed app** carries the **FFmpeg
// pin**'s build as its **Default component**, so `installed` points
// `FAMILYFLIX_FFMPEG_PATH` at the `ffmpeg.exe` `shellPaths` found under
// `resources\ffmpeg`. `dev` and `start` set none, so an unpackaged run keeps
// the FFmpeg on `PATH`. The Component slot is still read ahead of it.
describe('serverLaunch — the Default component', () => {
  const ELSEWHERE = join('E:', 'elsewhere');
  const carrying: ShellPaths = {
    ...INSTALLED,
    ffmpeg: join(ELSEWHERE, 'the-ffmpeg', 'ffmpeg.exe'),
  };

  it('installed points FAMILYFLIX_FFMPEG_PATH at the shipped ffmpeg.exe', () => {
    expect(
      serverLaunch('installed', PACKAGED_USER_DATA, INSTALLED).env
        .FAMILYFLIX_FFMPEG_PATH
    ).toBe(INSTALLED.ffmpeg);
  });

  it('installed reads that path off ShellPaths', () => {
    expect(
      serverLaunch('installed', PACKAGED_USER_DATA, carrying).env
        .FAMILYFLIX_FFMPEG_PATH
    ).toBe(carrying.ffmpeg);
  });

  it.each(['dev', 'start'] as const)(
    '%s sets no FAMILYFLIX_FFMPEG_PATH, so PATH’s FFmpeg stands in',
    (mode) => {
      expect(serverLaunch(mode, USER_DATA, UNPACKAGED).env).not.toHaveProperty(
        'FAMILYFLIX_FFMPEG_PATH'
      );
    }
  );

  it.each(['dev', 'start'] as const)(
    '%s sets none even when handed an ffmpeg path',
    (mode) => {
      expect(serverLaunch(mode, USER_DATA, carrying).env).not.toHaveProperty(
        'FAMILYFLIX_FFMPEG_PATH'
      );
    }
  );
});
