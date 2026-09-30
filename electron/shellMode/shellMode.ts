/**
 * The **Shell mode**: which of the three shapes this run is, named for what
 * runs it.
 *
 * - `'dev'` — `electron:dev`, an **Unpackaged run** with Vite serving the
 *   renderer.
 * - `'start'` — `electron:start`, an **Unpackaged run** in the installed
 *   shape, over the repo's own library.
 * - `'installed'` — the **Installed app**.
 */
export type ShellMode = 'dev' | 'start' | 'installed';

/** The environment the mode is read from: the one prod flag. */
export interface ShellModeEnv {
  /** `'1'` under `electron:start`. */
  FAMILYFLIX_SHELL_PROD?: string;
}

/**
 * Pure: the run's shape, read once. A packaged run is `'installed'` whatever
 * the prod flag says; unpackaged, the flag is `electron:start`.
 */
export function shellMode(isPackaged: boolean, env: ShellModeEnv): ShellMode {
  if (isPackaged) return 'installed';
  return env.FAMILYFLIX_SHELL_PROD === '1' ? 'start' : 'dev';
}
