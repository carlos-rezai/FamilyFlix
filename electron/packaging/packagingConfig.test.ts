// @vitest-environment node
//
// Issue #230 — the first **Installer**. `builderConfig.json` is what
// `packageApp.mjs` hands `electron-builder`'s `build()`, and this guard holds
// it to the units it must agree with: the App User Model ID, the one **App
// mark**, and `shellPaths`' reading of the **Packaged layout**. The config is
// read as data — no packager runs here, and no installer is built.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { APP_USER_MODEL_ID } from '../appIdentity/appIdentity';
import { shellPaths } from '../shellPaths/shellPaths';

interface ExtraResource {
  from: string;
  to: string;
}

interface BuilderConfig {
  appId?: string;
  productName?: string;
  copyright?: string;
  npmRebuild?: boolean;
  publish?: null;
  asarUnpack?: unknown;
  files?: string[];
  extraResources?: ExtraResource[];
  win?: { icon?: string; signAndEditExecutable?: boolean };
  electronFuses?: Record<string, unknown>;
  nsis?: {
    oneClick?: boolean;
    perMachine?: boolean;
    runAfterFinish?: boolean;
    deleteAppDataOnUninstall?: boolean;
    installerIcon?: string;
    installerHeaderIcon?: string;
    uninstallerIcon?: string;
    artifactName?: string;
  };
}

function readJson<T>(relative: string): T {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
  ) as T;
}

const config = (): BuilderConfig => readJson('./builderConfig.json');
const packageJson = (): Record<string, unknown> =>
  readJson('../../package.json');

const ICON = 'electron/assets/icon.ico';

/** The **Packaged layout**, as `shellPaths` reads it when installed. */
const RESOURCES_PATH = join('C:', 'FamilyFlix', 'resources');
const installedPaths = () =>
  shellPaths('installed', {
    appPath: join(RESOURCES_PATH, 'app.asar'),
    resourcesPath: RESOURCES_PATH,
    userData: join('C:', 'Users', 'family', 'AppData', 'Roaming'),
  });

describe('packagingConfig', () => {
  it('names the app by the App User Model ID main sets', () => {
    expect(config().appId).toBe(APP_USER_MODEL_ID);
  });

  it('wears the one App mark on the exe, the installer, its header and the uninstaller', () => {
    const { win, nsis } = config();

    expect(win?.icon).toBe(ICON);
    expect(nsis?.installerIcon).toBe(ICON);
    expect(nsis?.installerHeaderIcon).toBe(ICON);
    expect(nsis?.uninstallerIcon).toBe(ICON);
  });

  // Q18: rcedit is the step that writes the icon and the version resource into
  // an unsigned exe. Turning it off "to skip signing" ships Electron's atom
  // icon on FamilyFlix.exe.
  it('stamps the exe with the mark and the version, signed or not', () => {
    expect(config().win?.signAndEditExecutable).toBe(true);
  });

  it('installs one-click and per-user, keeps the family’s data on uninstall, and rebuilds nothing', () => {
    const { nsis, npmRebuild } = config();

    expect(nsis?.oneClick).toBe(true);
    expect(nsis?.perMachine).toBe(false);
    expect(nsis?.deleteAppDataOnUninstall).toBe(false);
    expect(npmRebuild).toBe(false);
  });

  it('puts each extra resource in the directory shellPaths reads under resourcesPath', () => {
    const installed = installedPaths();
    const read = [
      installed.renderer,
      dirname(installed.sqliteBinding),
      ...(installed.ffmpeg ? [dirname(installed.ffmpeg)] : []),
    ];
    const extraResources = config().extraResources ?? [];
    const placed = extraResources.map(({ to }) => join(RESOURCES_PATH, to));

    expect(extraResources.length).toBeGreaterThan(0);
    for (const directory of placed) {
      expect(read).toContain(directory);
    }
    expect(placed).toContain(installed.renderer);
    expect(placed).toContain(dirname(installed.sqliteBinding));
  });

  it('ships the binding from the directory the unpackaged shell reads it in', () => {
    const installed = installedPaths();
    const repo = join('D:', 'repo');
    const unpackaged = shellPaths('start', {
      appPath: repo,
      resourcesPath: join(
        repo,
        'node_modules',
        'electron',
        'dist',
        'resources'
      ),
      userData: join('C:', 'Users', 'maintainer', 'AppData', 'Roaming'),
    });
    const binding = (config().extraResources ?? []).find(
      ({ to }) => join(RESOURCES_PATH, to) === dirname(installed.sqliteBinding)
    );

    expect(binding).toBeDefined();
    expect(join(repo, binding?.from ?? '')).toBe(
      dirname(unpackaged.sqliteBinding)
    );
  });

  it('unpacks nothing from the asar', () => {
    expect(config().asarUnpack).toBeUndefined();
  });

  // Issue #236 — the preload is the asar's fifth file.
  // Q7: the asar holds what main requires and nothing else. A glob here would
  // ship whatever it matched — the silent-shipping risk `dependencies: {}`
  // exists to stop.
  it('packs only package.json, the three bundles and the icon into the asar, with no glob', () => {
    const files = config().files ?? [];

    expect([...files].sort()).toEqual(
      [
        'package.json',
        'electron/dist/main.js',
        'electron/dist/server.js',
        'electron/dist/preload.js',
        ICON,
      ].sort()
    );
    for (const entry of files) {
      expect(entry).not.toMatch(/[*?{}![\]]/);
    }
  });

  // With no `publish` here, electron-builder infers a GitHub provider off the
  // git remote and writes `resources\app-update.yml` into the layout — the
  // `publish: 'never'` packageApp passes stops the upload, not the inference.
  // The release feed is step 9's (Q1); until then the layout names none.
  it('names no release feed, so the layout carries no app-update.yml', () => {
    expect(config()).toHaveProperty('publish', null);
  });

  it('is versioned 0.1.0, by Carlos Rezai, with the config outside package.json', () => {
    const pkg = packageJson();

    expect(pkg.version).toBe('0.1.0');
    expect(pkg.author).toBe('Carlos Rezai');
    expect(pkg).not.toHaveProperty('build');
    expect(config().copyright).toBe('Copyright © 2026 Carlos Rezai');
    expect(config()).not.toHaveProperty('productName');
  });
});

// Issue #231 — FFmpeg on board. The **FFmpeg pin** is `{ version, url, sha256 }`
// in `ffmpegPin.json`, beside the config: one exact build, fetched over
// `https:` and held to a full SHA-256. `electron:ffmpeg` extracts it into
// `electron/.ffmpeg/`, and the config ships that directory to the place
// `shellPaths` reads the **Default component** from.

interface FfmpegPin {
  version?: unknown;
  url?: unknown;
  sha256?: unknown;
}

const pin = (): FfmpegPin => readJson('./ffmpegPin.json');

describe('the FFmpeg pin', () => {
  it('holds a SHA-256 of 64 hex characters', () => {
    expect(pin().sha256).toMatch(/^[0-9a-f]{64}$/i);
  });

  it('fetches over https:', () => {
    const { url } = pin();

    expect(typeof url).toBe('string');
    expect(new URL(String(url)).protocol).toBe('https:');
  });
});

describe('the Default component in the Packaged layout', () => {
  it('ships electron/.ffmpeg to the directory shellPaths reads ffmpeg.exe from', () => {
    const installed = installedPaths();
    const ffmpeg = (config().extraResources ?? []).find(
      ({ from }) => from === 'electron/.ffmpeg'
    );

    expect(installed.ffmpeg).not.toBeNull();
    expect(ffmpeg).toBeDefined();
    expect(join(RESOURCES_PATH, ffmpeg?.to ?? '')).toBe(
      dirname(installed.ffmpeg ?? '')
    );
  });
});

// Issue #232 — hardening. Four Electron fuses, set by electron-builder's own
// `electronFuses` key in `builderConfig.json`, close the run-as-Node doors and
// pin the app to its asar. `enableEmbeddedAsarIntegrityValidation` stays unset:
// on Windows it needs a signed exe. The server's `utilityProcess` reads none of
// them, so the installed app still forks its server.

describe('the electron fuses', () => {
  it('turns off running the exe as Node', () => {
    expect(config().electronFuses?.runAsNode).toBe(false);
  });

  it('turns off NODE_OPTIONS', () => {
    expect(config().electronFuses?.enableNodeOptionsEnvironmentVariable).toBe(
      false
    );
  });

  it('turns off the --inspect arguments', () => {
    expect(config().electronFuses?.enableNodeCliInspectArguments).toBe(false);
  });

  it('loads the app from its asar only', () => {
    expect(config().electronFuses?.onlyLoadAppFromAsar).toBe(true);
  });

  it('leaves embedded asar integrity validation unset, which needs a signed exe', () => {
    const fuses = config().electronFuses;

    expect(fuses).toBeDefined();
    expect(fuses).not.toHaveProperty('enableEmbeddedAsarIntegrityValidation');
  });
});
