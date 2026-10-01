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
  asarUnpack?: unknown;
  extraResources?: ExtraResource[];
  win?: { icon?: string; signAndEditExecutable?: boolean };
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

  it('installs one-click and per-user, keeps the family’s data on uninstall, and rebuilds nothing', () => {
    const { nsis, npmRebuild } = config();

    expect(nsis?.oneClick).toBe(true);
    expect(nsis?.perMachine).toBe(false);
    expect(nsis?.deleteAppDataOnUninstall).toBe(false);
    expect(npmRebuild).toBe(false);
  });

  it('puts each extra resource in the directory shellPaths reads under resourcesPath', () => {
    const resourcesPath = join('C:', 'FamilyFlix', 'resources');
    const installed = shellPaths('installed', {
      appPath: join(resourcesPath, 'app.asar'),
      resourcesPath,
      userData: join('C:', 'Users', 'family', 'AppData', 'Roaming'),
    });
    const read = [
      installed.renderer,
      dirname(installed.sqliteBinding),
      ...(installed.ffmpeg ? [dirname(installed.ffmpeg)] : []),
    ];
    const extraResources = config().extraResources ?? [];
    const placed = extraResources.map(({ to }) => join(resourcesPath, to));

    expect(extraResources.length).toBeGreaterThan(0);
    for (const directory of placed) {
      expect(read).toContain(directory);
    }
    expect(placed).toContain(installed.renderer);
    expect(placed).toContain(dirname(installed.sqliteBinding));
  });

  it('unpacks nothing from the asar', () => {
    expect(config().asarUnpack).toBeUndefined();
  });

  it('is versioned 0.1.0, by Carlos Rezai, with the config outside package.json', () => {
    const pkg = packageJson();

    expect(pkg.version).toBe('0.1.0');
    expect(pkg.author).toBe('Carlos Rezai');
    expect(pkg).not.toHaveProperty('build');
    expect(config().copyright).toBe('Copyright © 2026 Carlos Rezai');
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
    const resourcesPath = join('C:', 'FamilyFlix', 'resources');
    const installed = shellPaths('installed', {
      appPath: join(resourcesPath, 'app.asar'),
      resourcesPath,
      userData: join('C:', 'Users', 'family', 'AppData', 'Roaming'),
    });
    const ffmpeg = (config().extraResources ?? []).find(
      ({ from }) => from === 'electron/.ffmpeg'
    );

    expect(installed.ffmpeg).not.toBeNull();
    expect(ffmpeg).toBeDefined();
    expect(join(resourcesPath, ffmpeg?.to ?? '')).toBe(
      dirname(installed.ffmpeg ?? '')
    );
  });
});
