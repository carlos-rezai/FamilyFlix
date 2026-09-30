import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  shell,
  utilityProcess,
} from 'electron';

import { APP_USER_MODEL_ID } from './appIdentity/appIdentity';
import { downloadPath } from './downloadPath/downloadPath';
import { rendererUrl } from './rendererUrl/rendererUrl';
import { serverHandle, type ServerChild } from './serverHandle/serverHandle';
import { serverLaunch, type ServerLaunch } from './serverLaunch/serverLaunch';
import {
  isAppUrl,
  openExternalAllowed,
  permissionAllowed,
} from './windowPolicy/windowPolicy';

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

/** The **App mark**, rendered by `electron/scripts/buildIcon.mjs`. */
const ICON = join(cwd, 'electron', 'assets', 'icon.ico');

const dev = !app.isPackaged && process.env.FAMILYFLIX_SHELL_PROD !== '1';

if (!app.isPackaged) {
  app.setPath('userData', join(app.getPath('appData'), 'FamilyFlix (dev)'));
}

app.setAppUserModelId(APP_USER_MODEL_ID);

// The installed app has no menu bar; unpackaged runs keep theirs.
if (app.isPackaged) {
  Menu.setApplicationMenu(null);
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

/**
 * The window's rules: navigation stays on the app's origin, `https:` links go
 * to the default browser and nothing else leaves, `window.open` is always
 * denied, `fullscreen` is the one permission, and a download goes straight to
 * Downloads under a free name with no dialog.
 */
function applyWindowPolicy(target: BrowserWindow, appUrl: string): void {
  const contents = target.webContents;

  contents.on('will-navigate', (event, url) => {
    if (isAppUrl(url, appUrl)) return;
    event.preventDefault();
    if (openExternalAllowed(url)) void shell.openExternal(url);
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (openExternalAllowed(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  const session = contents.session;
  session.setPermissionRequestHandler((_contents, permission, callback) =>
    callback(permissionAllowed(permission))
  );
  session.setPermissionCheckHandler((_contents, permission) =>
    permissionAllowed(permission)
  );

  session.on('will-download', (_event, item) => {
    item.setSavePath(
      downloadPath(app.getPath('downloads'), item.getFilename(), existsSync)
    );
  });
}

function openWindow(port: number): void {
  window = new BrowserWindow({
    title: 'FamilyFlix',
    icon: ICON,
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

  const url = rendererUrl(dev, port);
  applyWindowPolicy(window, url);
  load(window, url);
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
