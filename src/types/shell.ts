/**
 * The **Shell handshake** — what the **Server process** and the **Desktop
 * shell** say to each other over Electron's parent port, typed once here and
 * imported by both sides (`server/src/shell/` and `electron/`). See
 * `docs/PRDs/24-electron-shell.md`, _The server process_.
 */

/**
 * The server to main: listening on `port`, or failed to start with `message`;
 * or the **Shell trash**'s request, `paths` to move to the Recycle Bin.
 */
export type ServerMessage =
  | { type: 'ready'; port: number }
  | { type: 'fatal'; message: string }
  | { type: 'trash'; id: string; paths: string[] };

/**
 * Main to the server: stop in order and exit; or the answer to the Shell
 * trash request `id` — `failed` the path the Recycle Bin would not take, else
 * `null`.
 */
export type ShellCommand =
  | { type: 'shutdown' }
  | { type: 'trashed'; id: string; failed: string | null };
