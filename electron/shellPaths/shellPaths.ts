import { join } from 'node:path';

import type { ShellMode } from '../shellMode/shellMode';

/** Electron's three locations, read once by main. */
export interface ShellLocations {
  /** `app.getAppPath()`: the repo unpackaged, `resources\app.asar` installed. */
  appPath: string;
  /** `process.resourcesPath`. */
  resourcesPath: string;
  /** `app.getPath('userData')`. */
  userData: string;
}

/** Every path the shell and the **Server process** need. */
export interface ShellPaths {
  /** The **App mark**, rendered by `electron/scripts/buildIcon.mjs`. */
  icon: string;
  /** The server bundle `buildElectron.mjs` writes. */
  serverEntry: string;
  /** The built renderer the server serves beside `/api`. */
  renderer: string;
  /** The Electron-ABI `better-sqlite3` binding. */
  sqliteBinding: string;
  /** The Default component's `ffmpeg.exe`, or `null` when none is carried. */
  ffmpeg: string | null;
  /** The working directory the server is forked in. */
  serverCwd: string;
  /**
   * The **Managed media directory**: where the server's `./media` resolves
   * under `serverCwd` — the one spelling the server's `FAMILYFLIX_MEDIA_PATH`
   * and Open folder both read.
   */
  mediaRoot: string;
}

/**
 * Pure: the paths for this **Shell mode**. Unpackaged (`dev`, `start`),
 * `appPath` is the repo and every path is under it. Installed — the
 * **Packaged layout** — the icon and both bundles come from `appPath` (inside
 * `app.asar`), the renderer, the binding and `ffmpeg.exe` from
 * `resourcesPath`, and the server is forked in `userData`, because a working
 * directory cannot be inside an asar.
 */
export function shellPaths(
  mode: ShellMode,
  { appPath, resourcesPath, userData }: ShellLocations
): ShellPaths {
  const fromApp = {
    icon: join(appPath, 'electron', 'assets', 'icon.ico'),
    serverEntry: join(appPath, 'electron', 'dist', 'server.js'),
  };

  if (mode === 'installed') {
    return {
      ...fromApp,
      renderer: join(resourcesPath, 'renderer'),
      sqliteBinding: join(resourcesPath, 'native', 'better_sqlite3.node'),
      ffmpeg: join(resourcesPath, 'ffmpeg', 'ffmpeg.exe'),
      serverCwd: userData,
      mediaRoot: join(userData, 'media'),
    };
  }

  return {
    ...fromApp,
    renderer: join(appPath, 'dist', 'familyflix'),
    sqliteBinding: join(appPath, 'electron', '.native', 'better_sqlite3.node'),
    ffmpeg: null,
    serverCwd: appPath,
    mediaRoot: join(appPath, 'media'),
  };
}
