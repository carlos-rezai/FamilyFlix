import { join } from 'node:path';

import type { ShellMode } from '../shellMode/shellMode';

/** What main hands `utilityProcess.fork()` to start the **Server process**. */
export interface ServerLaunch {
  /** The module the process runs. */
  entry: string;
  /** The environment the server reads, beside the inherited one. */
  env: Record<string, string>;
}

/** The port `electron:dev` forks the server on, the one Vite proxies to. */
const DEV_PORT = '3001';

/**
 * Where `electron:native` puts the Electron-ABI `better-sqlite3` binding,
 * relative to the repo: gitignored, so Vitest keeps the package's own.
 */
export function nativeBindingPath(cwd: string): string {
  return join(cwd, 'electron', '.native', 'better_sqlite3.node');
}

/**
 * The **Shell port** the installed shape listens on: fixed, so the renderer's
 * origin — and with it `localStorage`, the volume — survives a relaunch.
 */
const SHELL_PORT = '41720';

/**
 * Pure: how to start the **Server process** in this **Shell mode**. Every mode
 * forks the bundled server `buildElectron.mjs` writes — under `electron:dev`
 * its watcher rebuilds it — so there is one fork path, and it is the one the
 * **Installed app** runs.
 *
 * - `'dev'` (`electron:dev`): `3001`, Vite serving the renderer.
 * - `'start'` (`electron:start`): the installed shape — the **Shell port**,
 *   the built renderer.
 * - `'installed'`: the installed shape, plus the database, the managed media
 *   directory and the **Component slot** under `userData`, the **Trusted
 *   hosts** set empty, and the package's own SQLite binding.
 *
 * Unpackaged runs use the repo's own `./familyflix.db`, `./media` and
 * `./playback-component`, and the Electron-ABI binding `electron:native`
 * fetched.
 */
export function serverLaunch(
  mode: ShellMode,
  userData: string,
  cwd: string
): ServerLaunch {
  const entry = join(cwd, 'electron', 'dist', 'server.js');

  if (mode === 'dev') {
    return {
      entry,
      env: {
        PORT: DEV_PORT,
        FAMILYFLIX_SQLITE_BINDING: nativeBindingPath(cwd),
      },
    };
  }

  const installed: Record<string, string> = {
    PORT: SHELL_PORT,
    FAMILYFLIX_RENDERER_PATH: join(cwd, 'dist', 'familyflix'),
  };
  const env: Record<string, string> =
    mode === 'installed'
      ? {
          ...installed,
          FAMILYFLIX_DB_PATH: join(userData, 'familyflix.db'),
          FAMILYFLIX_MEDIA_PATH: join(userData, 'media'),
          FAMILYFLIX_COMPONENT_PATH: join(userData, 'playback-component'),
          FAMILYFLIX_TRUSTED_HOSTS: '',
        }
      : { ...installed, FAMILYFLIX_SQLITE_BINDING: nativeBindingPath(cwd) };

  return { entry, env };
}
