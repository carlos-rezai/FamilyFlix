import { join } from 'node:path';
import { app, BrowserWindow, dialog, utilityProcess } from 'electron';

import { rendererUrl } from './rendererUrl/rendererUrl';
import { serverHandle, type ServerChild } from './serverHandle/serverHandle';
import { serverLaunch, type ServerLaunch } from './serverLaunch/serverLaunch';

/**
 * The **Desktop shell**'s main process: a composition root with no logic of
 * its own. It forks the **Server process**, waits for the **Shell
 * handshake**'s `ready`, and opens the one window over it. See
 * `docs/PRDs/24-electron-shell.md`.
 */

/** The window's background, the app's own, so nothing flashes white. */
const BACKGROUND = '#14110d';

/** How long to wait before asking Vite again while it is still starting. */
const RENDERER_RETRY_MS = 500;

/** How long the **Ordered shutdown** has before the server is killed. */
const SHUTDOWN_MS = 5_000;

const cwd = process.cwd();
const dev = !app.isPackaged && process.env.FAMILYFLIX_SHELL_PROD !== '1';

if (!app.isPackaged) {
  app.setPath('userData', join(app.getPath('appData'), 'FamilyFlix (dev)'));
}

let window: BrowserWindow | null = null;

/**
 * `utilityProcess.fork()` over a launch: the server on Electron's own Node,
 * through `serverBoot.mjs`, which applies the `--import`s a utility process
 * would otherwise ignore.
 */
function fork(launch: ServerLaunch): ServerChild {
  return utilityProcess.fork(
    join(cwd, 'electron', 'serverBoot.mjs'),
    [launch.entry, ...launch.execArgv],
    {
      cwd,
      env: { ...process.env, ...launch.env },
      serviceName: 'FamilyFlix server',
      stdio: 'inherit',
    }
  );
}

/** Load the renderer, asking again until Vite answers. */
function load(target: BrowserWindow, url: string): void {
  target.loadURL(url).catch(() => {
    if (!target.isDestroyed()) {
      setTimeout(() => load(target, url), RENDERER_RETRY_MS);
    }
  });
}

function openWindow(port: number): void {
  window = new BrowserWindow({
    title: 'FamilyFlix',
    backgroundColor: BACKGROUND,
    show: false,
    minWidth: 1024,
    minHeight: 640,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      nodeIntegration: false,
    },
  });

  window.once('ready-to-show', () => {
    window?.maximize();
    window?.show();
  });
  // The window is FamilyFlix, whatever the page's own `<title>` says.
  window.on('page-title-updated', (event) => event.preventDefault());
  window.on('closed', () => {
    window = null;
  });

  if (dev) {
    window.webContents.openDevTools();
  }

  load(window, rendererUrl(dev, port));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (window === null) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  app.on('window-all-closed', () => app.quit());

  app.whenReady().then(async () => {
    const server = serverHandle({
      fork,
      launch: serverLaunch(app.isPackaged, !dev, app.getPath('userData'), cwd),
      onExit: () => app.quit(),
    });

    // Quit waits out the server's **Ordered shutdown**, killing it at 5 s.
    let stopping: Promise<void> | undefined;
    let stopped = false;
    app.on('before-quit', (event) => {
      if (stopped) return;
      event.preventDefault();
      stopping ??= server.shutdown(SHUTDOWN_MS).then(() => {
        stopped = true;
        app.quit();
      });
    });

    try {
      const { port } = await server.start();
      openWindow(port);
    } catch (error) {
      dialog.showErrorBox(
        'FamilyFlix could not start',
        error instanceof Error ? error.message : String(error)
      );
      app.exit(1);
    }
  });
}
