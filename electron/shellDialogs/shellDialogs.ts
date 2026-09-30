import type { ServerHandle } from '../serverHandle/serverHandle';

/**
 * The shell's two failure dialogs, so the family always has something to
 * press: the startup dialog, and the one an unexpected exit after `ready`
 * raises. Electron's `dialog`, `shell.openPath` and `app` are injected, and
 * so is the **Shell log**: each dialog logs what it tells the family before
 * the box is shown, because that is what the maintainer reads back from the
 * parents' machine (Q28).
 */

/** The part of Electron's `MessageBoxOptions` the dialogs use. */
export interface MessageBox {
  type: 'error' | 'warning';
  title: string;
  message: string;
  detail?: string;
  buttons: string[];
  defaultId: number;
  cancelId: number;
  noLink: boolean;
}

export interface DialogWorld {
  userData: string;
  /** The **Shell log**'s `main`. */
  log(text: string): void;
  showMessageBox(box: MessageBox): Promise<{ response: number }>;
  /** `shell.openPath`. */
  openPath(path: string): Promise<string>;
  /** `app.relaunch`. */
  relaunch(): void;
  /** `app.exit`. */
  exit(code: number): void;
}

const QUIT = 'Quit';
const SHOW_DATA_FOLDER = 'Show data folder';
const RESTART = 'Restart';

/**
 * "FamilyFlix couldn't start.", the error as its detail: Quit, or Show data
 * folder, which opens `userData` first. Either way the app then leaves.
 */
export async function startupFailed(
  world: DialogWorld,
  error: unknown
): Promise<void> {
  const buttons = [QUIT, SHOW_DATA_FOLDER];
  const message = 'FamilyFlix couldn’t start.';
  const detail = error instanceof Error ? error.message : String(error);
  world.log(`${message} ${detail}`);
  const { response } = await world.showMessageBox({
    type: 'error',
    title: 'FamilyFlix',
    message,
    detail,
    buttons,
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (buttons[response] === SHOW_DATA_FOLDER) {
    await world.openPath(world.userData);
  }
  world.exit(1);
}

/**
 * "FamilyFlix stopped unexpectedly.": Restart relaunches and then exits;
 * Quit exits.
 */
export async function stoppedUnexpectedly(world: DialogWorld): Promise<void> {
  const buttons = [RESTART, QUIT];
  const message = 'FamilyFlix stopped unexpectedly.';
  world.log(message);
  const { response } = await world.showMessageBox({
    type: 'error',
    title: 'FamilyFlix',
    message,
    buttons,
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (buttons[response] === RESTART) {
    world.relaunch();
    world.exit(0);
    return;
  }
  world.exit(1);
}

/**
 * Start the server, putting every startup failure — a `fatal`, the 15 s
 * timeout, an exit before `ready` — in front of the startup dialog. Resolves
 * with the port, or `null` once the dialog has been answered.
 */
export async function startServer(
  server: ServerHandle,
  world: DialogWorld
): Promise<{ port: number } | null> {
  try {
    return await server.start();
  } catch (error) {
    await startupFailed(world, error);
    return null;
  }
}
