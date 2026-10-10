import type { ShellMode } from '../shellMode/shellMode';
import type { ShellPaths } from '../shellPaths/shellPaths';

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
 *   directory and the **Component slot** under `userData`, the
 *   **Trusted hosts** set empty, and `FAMILYFLIX_FFMPEG_PATH` at the
 *   **Default component** under `resources\ffmpeg` — unpackaged runs set
 *   none, so the FFmpeg on `PATH` stands in.
 *
 * Every path it hands the fork is one `shellPaths` answered: the entry, the
 * renderer, the Electron-ABI binding — `electron:native`'s unpackaged,
 * `resources\native`'s installed — and, installed, the database, the media
 * and the slot. Unpackaged runs set none of those three, so the repo's own
 * `./familyflix.db`, `./media` and `./playback-component` are used.
 */
export function serverLaunch(mode: ShellMode, paths: ShellPaths): ServerLaunch {
  const entry = paths.serverEntry;

  if (mode === 'dev') {
    return {
      entry,
      env: {
        PORT: DEV_PORT,
        FAMILYFLIX_SQLITE_BINDING: paths.sqliteBinding,
      },
    };
  }

  const installed: Record<string, string> = {
    PORT: SHELL_PORT,
    FAMILYFLIX_RENDERER_PATH: paths.renderer,
    FAMILYFLIX_SQLITE_BINDING: paths.sqliteBinding,
  };
  const env: Record<string, string> =
    mode === 'installed'
      ? {
          ...installed,
          FAMILYFLIX_DB_PATH: paths.database,
          FAMILYFLIX_MEDIA_PATH: paths.mediaRoot,
          FAMILYFLIX_COMPONENT_PATH: paths.componentSlot,
          FAMILYFLIX_TRUSTED_HOSTS: '',
          ...(paths.ffmpeg ? { FAMILYFLIX_FFMPEG_PATH: paths.ffmpeg } : {}),
        }
      : installed;

  return { entry, env };
}
