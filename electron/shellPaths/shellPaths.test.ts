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

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

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

    // Issue #292 — the **Managed media directory** Open folder opens: where
    // the server's default `./media` resolves under `serverCwd`.
    it('finds the managed media directory at <appPath>\\media', () => {
      expect(paths().mediaRoot).toBe(join(REPO, 'media'));
    });

    // Issue #293 — the database and the **Component slot** join it: where the
    // server's `./familyflix.db` and `./playback-component` resolve under
    // `serverCwd`.
    it('finds the database at <appPath>\\familyflix.db', () => {
      expect(paths().database).toBe(join(REPO, 'familyflix.db'));
    });

    it('finds the Component slot at <appPath>\\playback-component', () => {
      expect(paths().componentSlot).toBe(join(REPO, 'playback-component'));
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

  // Issue #292 — `%APPDATA%\FamilyFlix\media`, the one spelling the server's
  // `FAMILYFLIX_MEDIA_PATH` and Open folder both read.
  it('finds the managed media directory at userData\\media', () => {
    expect(paths().mediaRoot).toBe(join(USER_DATA, 'media'));
  });

  // Issue #293 — `%APPDATA%\FamilyFlix\familyflix.db` and
  // `%APPDATA%\FamilyFlix\playback-component`, the one spelling each of the
  // server's `FAMILYFLIX_DB_PATH` and `FAMILYFLIX_COMPONENT_PATH`.
  it('finds the database at userData\\familyflix.db', () => {
    expect(paths().database).toBe(join(USER_DATA, 'familyflix.db'));
  });

  it('finds the Component slot at userData\\playback-component', () => {
    expect(paths().componentSlot).toBe(join(USER_DATA, 'playback-component'));
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

// Issue #512: the Linux build. `shellPaths` takes a third argument, the
// platform, defaulting to `process.platform` (`folderOverlap`'s precedent).
// Off Windows the installed mode carries the extensionless `ffmpeg` and both
// modes answer `icon.png`; on Windows nothing changes. Main keeps calling it
// with two arguments.

const LOCATIONS = {
  unpackaged: {
    appPath: REPO,
    resourcesPath: ELECTRON_RESOURCES,
    userData: DEV_USER_DATA,
  },
  installed: { appPath: ASAR, resourcesPath: RESOURCES, userData: USER_DATA },
} as const;

describe('shellPaths on Linux', () => {
  it('installed, carries the extensionless ffmpeg under resources/ffmpeg', () => {
    expect(shellPaths('installed', LOCATIONS.installed, 'linux').ffmpeg).toBe(
      join(RESOURCES, 'ffmpeg', 'ffmpeg')
    );
  });

  it('installed, finds the App mark as icon.png inside app.asar', () => {
    expect(shellPaths('installed', LOCATIONS.installed, 'linux').icon).toBe(
      join(ASAR, 'electron', 'assets', 'icon.png')
    );
  });

  it.each(['dev', 'start'] as const)(
    '%s, finds the App mark as icon.png under electron/assets',
    (mode) => {
      expect(shellPaths(mode, LOCATIONS.unpackaged, 'linux').icon).toBe(
        join(REPO, 'electron', 'assets', 'icon.png')
      );
    }
  );

  it.each(['dev', 'start'] as const)(
    '%s, carries no FFmpeg, so PATH stands in',
    (mode) => {
      expect(shellPaths(mode, LOCATIONS.unpackaged, 'linux').ffmpeg).toBeNull();
    }
  );
});

describe('shellPaths on Windows answers exactly today’s paths', () => {
  it.each(['dev', 'start'] as const)('%s', (mode) => {
    expect(shellPaths(mode, LOCATIONS.unpackaged, 'win32')).toEqual({
      icon: join(REPO, 'electron', 'assets', 'icon.ico'),
      serverEntry: join(REPO, 'electron', 'dist', 'server.js'),
      renderer: join(REPO, 'dist', 'familyflix'),
      sqliteBinding: join(REPO, 'electron', '.native', 'better_sqlite3.node'),
      ffmpeg: null,
      serverCwd: REPO,
      mediaRoot: join(REPO, 'media'),
      database: join(REPO, 'familyflix.db'),
      componentSlot: join(REPO, 'playback-component'),
    });
  });

  it('installed', () => {
    expect(shellPaths('installed', LOCATIONS.installed, 'win32')).toEqual({
      icon: join(ASAR, 'electron', 'assets', 'icon.ico'),
      serverEntry: join(ASAR, 'electron', 'dist', 'server.js'),
      renderer: join(RESOURCES, 'renderer'),
      sqliteBinding: join(RESOURCES, 'native', 'better_sqlite3.node'),
      ffmpeg: join(RESOURCES, 'ffmpeg', 'ffmpeg.exe'),
      serverCwd: USER_DATA,
      mediaRoot: join(USER_DATA, 'media'),
      database: join(USER_DATA, 'familyflix.db'),
      componentSlot: join(USER_DATA, 'playback-component'),
    });
  });
});

describe.each([
  ['dev', LOCATIONS.unpackaged],
  ['start', LOCATIONS.unpackaged],
  ['installed', LOCATIONS.installed],
] as const)('shellPaths, %s: every other path', (mode, locations) => {
  it('is the same on Windows and Linux', () => {
    const withoutPlatformPaths = (platform: NodeJS.Platform) => {
      const {
        icon: _icon,
        ffmpeg: _ffmpeg,
        ...rest
      } = shellPaths(mode, locations, platform);
      return rest;
    };

    expect(withoutPlatformPaths('linux')).toEqual(
      withoutPlatformPaths('win32')
    );
  });
});

describe('shellPaths without a platform', () => {
  const realPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

  afterEach(() => {
    if (realPlatform) Object.defineProperty(process, 'platform', realPlatform);
  });

  it('answers icon.png and the extensionless ffmpeg when process.platform is linux', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });

    const paths = shellPaths('installed', LOCATIONS.installed);

    expect(paths.icon).toBe(join(ASAR, 'electron', 'assets', 'icon.png'));
    expect(paths.ffmpeg).toBe(join(RESOURCES, 'ffmpeg', 'ffmpeg'));
  });

  it.each(['win32', 'linux'] as const)(
    'behaves as process.platform when it is %s',
    (platform) => {
      Object.defineProperty(process, 'platform', { value: platform });

      for (const [mode, locations] of [
        ['dev', LOCATIONS.unpackaged],
        ['installed', LOCATIONS.installed],
      ] as const) {
        expect(shellPaths(mode, locations)).toEqual(
          shellPaths(mode, locations, platform)
        );
      }
    }
  );

  it('is still called by main with two arguments', () => {
    expect(mainSource()).toMatch(/shellPaths\(\s*mode,\s*\{[^}]*\}\s*\)/);
  });
});

const ELECTRON_DIR = fileURLToPath(new URL('..', import.meta.url));
const THIS_FILE = fileURLToPath(import.meta.url);

/** Every source file under `electron/`, skipping builds and fetched binaries. */
function electronSources(dir = ELECTRON_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return ['dist', '.native', 'node_modules'].includes(entry.name)
        ? []
        : electronSources(path);
    }

    return /\.(ts|mjs)$/.test(entry.name) ? [path] : [];
  });
}

describe('the shell’s boundaries', () => {
  // `src/types/` is the one shared module both build targets read; nothing
  // else outside `electron/`, and never the server (its `EXE` included).
  it('imports nothing from outside electron/ but src/types', () => {
    const shipping = electronSources().filter(
      (file) =>
        !/\.test\.ts$/.test(file) &&
        !file.includes(`${sep}test-support${sep}`) &&
        !file.includes(`${sep}scripts${sep}`)
    );
    const sharedTypes = join(ELECTRON_DIR, '..', 'src', 'types');

    for (const file of shipping) {
      const specifiers = [
        ...readFileSync(file, 'utf8').matchAll(
          /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g
        ),
      ].map((match) => match[1]);

      for (const specifier of specifiers) {
        if (!specifier.startsWith('.')) continue;

        const target = resolve(dirname(file), specifier);

        if (relative(ELECTRON_DIR, target).startsWith('..')) {
          expect(
            relative(sharedTypes, target),
            `${relative(ELECTRON_DIR, file)} imports ${specifier}`
          ).not.toMatch(/^\.\./);
        }
      }
    }
  });

  it('has no behavioural docblock naming Explorer, only the file manager', () => {
    const offenders = electronSources()
      .filter((file) => file !== THIS_FILE)
      .filter((file) => /\bExplorer\b/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ELECTRON_DIR, file));

    expect(offenders).toEqual([]);
  });
});
