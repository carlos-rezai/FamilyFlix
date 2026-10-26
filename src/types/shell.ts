/**
 * The **Shell handshake** — what the **Server process** and the **Desktop
 * shell** say to each other over Electron's parent port, typed once here and
 * imported by both sides (`server/src/shell/` and `electron/`). See
 * `docs/PRDs/24-electron-shell.md`, _The server process_.
 */

/** The server to main: listening on `port`, or failed to start with `message`. */
export type ServerMessage =
  | { type: 'ready'; port: number }
  | { type: 'fatal'; message: string };

/** Main to the server: stop in order and exit. */
export type ShellCommand = { type: 'shutdown' };
