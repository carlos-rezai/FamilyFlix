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
  ipcMain,
  Menu,
  type OpenDialogOptions,
  shell,
  utilityProcess,
} from 'electron';
import { autoUpdater } from 'electron-updater';

import { FOLDER_CHANNELS } from '../src/types/libraryFolders';
import { UPDATE_CHANNELS } from '../src/types/update';

import { APP_USER_MODEL_ID } from './appIdentity/appIdentity';
import { createUpdates } from './createUpdates/createUpdates';
import { downloadPath } from './downloadPath/downloadPath';
import { loadRenderer } from './loadRenderer/loadRenderer';
import {
  openMediaFolder,
  type MediaFolderWorld,
} from './openMediaFolder/openMediaFolder';
import { pickFolders, pickOneFolder } from './pickFolders/pickFolders';
import { quitAfterShutdown } from './quitAfterShutdown/quitAfterShutdown';
import { reloadOnce } from './reloadOnce/reloadOnce';
import { rendererUrl } from './rendererUrl/rendererUrl';
import { serverHandle, type ServerChild } from './serverHandle/serverHandle';
import { serverLaunch, type ServerLaunch } from './serverLaunch/serverLaunch';
import { shellMode } from './shellMode/shellMode';
import { shellPaths } from './shellPaths/shellPaths';
import { splashPage } from './splashPage/splashPage';
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
 * its own. It opens the one window over the **Start-up splash**, forks the
 * **Server process**, and loads the app over the splash when the **Shell
 * handshake**'s `ready` lands. See `docs/PRDs/24-electron-shell.md` and
 * `docs/PRDs/53-loading-states.md`.
 */

/** The window's background, the app's own, so nothing flashes white. */
const BACKGROUND = '#14110d';

/** How long the **Ordered shutdown** has before the server is killed. */
const SHUTDOWN_MS = 5_000;

const mode = shellMode(app.isPackaged, process.env);

if (mode !== 'installed') {
  app.setPath('userData', join(app.getPath('appData'), 'FamilyFlix (dev)'));
}

const paths = shellPaths(mode, {
  appPath: app.getAppPath(),
  resourcesPath: process.resourcesPath,
  userData: app.getPath('userData'),
});

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

/**
 * Electron's `dialog`, `shell.openPath` and `app`, and the **Shell log**, for
 * the failure dialogs.
 */
const dialogWorld: DialogWorld = {
  userData: app.getPath('userData'),
  log: (text) => log.main(text),
  showMessageBox: (box) =>
    window && !window.isDestroyed()
      ? dialog.showMessageBox(window, box)
      : dialog.showMessageBox(box),
  openPath: (path) => shell.openPath(path),
  relaunch: () => app.relaunch(),
  exit: (code) => app.exit(code),
};

/**
 * Node's `mkdirSync`, Electron's `shell.openPath` and the **Shell log**, for
 * Open folder.
 */
const mediaFolderWorld: MediaFolderWorld = {
  mkdir: (path) => mkdirSync(path, { recursive: true }),
  openPath: (path) => shell.openPath(path),
  log: (text) => log.main(text),
};

/** `utilityProcess.fork()` over a launch: the server on Electron's own Node. */
function fork(launch: ServerLaunch): ServerChild {
  const child = utilityProcess.fork(launch.entry, [], {
    cwd: paths.serverCwd,
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

/**
 * Open the one window over the **Start-up splash** and show it as soon as the
 * splash is painted, before the server's `ready`.
 */
function openWindow(preload: string): void {
  window = new BrowserWindow({
    title: 'FamilyFlix',
    icon: paths.icon,
    backgroundColor: BACKGROUND,
    show: false,
    minWidth: 1024,
    minHeight: 640,
    webPreferences: {
      preload,
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

  // A splash load the app's own load supersedes is aborted, not a failure.
  window.loadURL(splashPage()).catch(() => undefined);
}

/** Load the app over the splash, in the same window, once the server is up. */
function openApp(port: number): void {
  if (window === null || window.isDestroyed()) return;
  const url = rendererUrl(mode, port);
  applyWindowPolicy(window, url);
  const target = window;
  loadRenderer(
    {
      loadURL: (next) => target.loadURL(next),
      clearHistory: () => target.webContents.navigationHistory.clear(),
      isDestroyed: () => target.isDestroyed(),
    },
    url
  );
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
      launch: serverLaunch(mode, paths),
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

    openWindow(join(__dirname, 'preload.js'));

    log.main('Starting the server.');
    const started = await startServer(server, dialogWorld);
    if (started === null) return;
    log.main(`Server ready on port ${started.port}.`);

    // **Software update**: only the installed app checks; every other Shell
    // mode answers `unavailable`.
    const updates = createUpdates({
      updater: autoUpdater,
      enabled: mode === 'installed',
      now: () => new Date(),
      shutdown: () => server.shutdown(SHUTDOWN_MS),
      onStatus: (status) => {
        if (window && !window.isDestroyed()) {
          window.webContents.send(UPDATE_CHANNELS.status, status);
        }
      },
      log: (text) => log.main(text),
    });
    ipcMain.handle(UPDATE_CHANNELS.current, () => updates.current());
    ipcMain.handle(UPDATE_CHANNELS.check, () => updates.check());
    ipcMain.on(UPDATE_CHANNELS.install, () => updates.install());

    // The system folder dialog, over the window while there is one.
    const showFolderDialog = (options: OpenDialogOptions) =>
      window
        ? dialog.showOpenDialog(window, options)
        : dialog.showOpenDialog(options);

    // The **Library folders page**'s _Browse…_: several folders at once, a
    // cancel answered as `[]`.
    ipcMain.handle(FOLDER_CHANNELS.pick, async () =>
      pickFolders(
        await showFolderDialog({
          title: 'Add library folders',
          properties: ['openDirectory', 'multiSelections'],
        })
      )
    );

    // The Export dialog's _Browse…_: one destination folder, a cancel
    // answered as `null`.
    ipcMain.handle(FOLDER_CHANNELS.pickOne, async () =>
      pickOneFolder(
        await showFolderDialog({
          title: 'Choose a folder',
          properties: ['openDirectory', 'createDirectory'],
        })
      )
    );

    // Import setup's spreadsheet _Browse…_: one `.xlsx` or `.csv`, a cancel
    // answered as `null` — the one-folder reading, since it is one path too.
    ipcMain.handle(FOLDER_CHANNELS.pickSheet, async () =>
      pickOneFolder(
        await showFolderDialog({
          title: 'Choose a spreadsheet',
          properties: ['openFile'],
          filters: [{ name: 'Spreadsheets', extensions: ['xlsx', 'csv'] }],
        })
      )
    );

    // The Storage card's _Open folder_: no argument, the **Managed media
    // directory** made if absent and shown in Explorer; a failure logged.
    ipcMain.handle(FOLDER_CHANNELS.openMedia, () =>
      openMediaFolder(paths.mediaRoot, mediaFolderWorld)
    );

    openApp(started.port);
    void updates.start();
  });
}
