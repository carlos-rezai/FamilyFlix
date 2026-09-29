import { join } from 'node:path';

/** What main hands `utilityProcess.fork()` to start the **Server process**. */
export interface ServerLaunch {
  /** The module the process runs. */
  entry: string;
  /** Node flags for the process. */
  execArgv: string[];
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
 * Pure: how to start the **Server process** for this run.
 *
 * This slice covers the dev combination only — unpackaged, no
 * `FAMILYFLIX_SHELL_PROD` — so `isPackaged`, `prodFlag` and `userData` are
 * not read yet. The server is forked from source through tsx on `3001`,
 * pointed at the Electron-ABI SQLite binding, and — because an unpackaged run
 * uses the repo's own `./familyflix.db`, `./media` and `./playback-component`
 * — none of the three path variables is set.
 */
export function serverLaunch(
  _isPackaged: boolean,
  _prodFlag: boolean,
  _userData: string,
  cwd: string
): ServerLaunch {
  return {
    entry: join(cwd, 'server', 'src', 'main.ts'),
    execArgv: ['--import', 'tsx'],
    env: {
      PORT: DEV_PORT,
      FAMILYFLIX_SQLITE_BINDING: nativeBindingPath(cwd),
    },
  };
}
