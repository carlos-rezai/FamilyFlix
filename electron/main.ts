import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
} from 'node:fs';
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
import { loadRenderer } from './loadRenderer/loadRenderer';
import { quitAfterShutdown } from './quitAfterShutdown/quitAfterShutdown';
import { reloadOnce } from './reloadOnce/reloadOnce';
import { rendererUrl } from './rendererUrl/rendererUrl';
import { serverHandle, type ServerChild } from './serverHandle/serverHandle';
import { serverLaunch, type ServerLaunch } from './serverLaunch/serverLaunch';
import { shellMode } from './shellMode/shellMode';
import {
  startServer,
  stoppedUnexpectedly,
  type DialogWorld,
} from './shellDialogs/shellDialogs';
import { shellLog, type LogFileSystem } from './shellLog/shellLog';
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

/** How long the **Ordered shutdown** has before the server is killed. */
const SHUTDOWN_MS = 5_000;

const cwd = process.cwd();

/** The **App mark**, rendered by `electron/scripts/buildIcon.mjs`. */
const ICON = join(cwd, 'electron', 'assets', 'icon.ico');

const mode = shellMode(app.isPackaged, process.env);

if (mode !== 'installed') {
  app.setPath('userData', join(app.getPath('appData'), 'FamilyFlix (dev)'));
}

app.setAppUserModelId(APP_USER_MODEL_ID);

// The installed app has no menu bar; unpackaged runs keep theirs.
if (mode === 'installed') {
  Menu.setApplicationMenu(null);
}

let window: BrowserWindow | null = null;

/** The **Shell log**'s file system: Node's own, synchronous. */
const logFs: LogFileSystem = {
  size(path) {
    try {
      return statSync(path).size;
    } catch {
      return undefined;
    }
  },
  rename: (from, to) => renameSync(from, to),
  append: (path, text) => appendFileSync(path, text),
  mkdir: (dir) => mkdirSync(dir, { recursive: true }),
};

const log = shellLog({
  toFile: mode === 'installed',
  dir: join(app.getPath('userData'), 'logs'),
  fs: logFs,
  terminal: (text) => process.stdout.write(text),
});

/** Electron's `dialog`, `shell.openPath` and `app`, for the failure dialogs. */
const dialogWorld: DialogWorld = {
  userData: app.getPath('userData'),
  showMessageBox: (box) =>
    window && !window.isDestroyed()
      ? dialog.showMessageBox(window, box)
      : dialog.showMessageBox(box),
  openPath: (path) => shell.openPath(path),
  relaunch: () => app.relaunch(),
  exit: (code) => app.exit(code),
};

/** `utilityProcess.fork()` over a launch: the server on Electron's own Node. */
function fork(launch: ServerLaunch): ServerChild {
  const child = utilityProcess.fork(launch.entry, [], {
    cwd,
    env: { ...process.env, ...launch.env },
    serviceName: 'FamilyFlix server',
    stdio: 'pipe',
  });
  child.stdout?.on('data', (chunk: Buffer) => log.server(chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => log.server(chunk.toString()));
  return child;
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
  // A crashed renderer is reloaded once; a second crash is left as it is.
  const onRendererGone = reloadOnce({
    reload: () => window?.webContents.reload(),
    isGone: () => window === null || window.isDestroyed(),
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    log.main(`Renderer gone: ${details.reason}`);
    onRendererGone();
  });
  window.on('closed', () => {
    window = null;
  });

  if (mode === 'dev') {
    window.webContents.openDevTools();
  }

  const url = rendererUrl(mode, port);
  applyWindowPolicy(window, url);
  loadRenderer(window, url);
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
      launch: serverLaunch(mode, app.getPath('userData'), cwd),
      onExit: (code) => {
        log.main(`Server exited unexpectedly with code ${code}.`);
        void stoppedUnexpectedly(dialogWorld);
      },
    });

    // Quit waits out the server's **Ordered shutdown**, killing it at 5 s.
    app.on(
      'before-quit',
      quitAfterShutdown({
        shutdown: server.shutdown,
        ms: SHUTDOWN_MS,
        quit: () => app.quit(),
      })
    );

    log.main('Starting the server.');
    const started = await startServer(server, {
      ...dialogWorld,
      showMessageBox: (box) => {
        log.main(`${box.message} ${box.detail ?? ''}`);
        return dialogWorld.showMessageBox(box);
      },
    });
    if (started === null) return;
    log.main(`Server ready on port ${started.port}.`);
    openWindow(started.port);
  });
}
