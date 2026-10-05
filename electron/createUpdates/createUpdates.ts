import type { UpdateCheck, UpdateStatus } from '../../src/types/update';

/** What a check settles with: `electron-updater`'s result, or `null`. */
export type UpdateCheckResult = {
  isUpdateAvailable: boolean;
  updateInfo: { version: string };
} | null;

/** The updater's logger, the shape `electron-updater` calls. */
export interface UpdaterLogger {
  info(message?: unknown): void;
  warn(message?: unknown): void;
  error(message?: unknown): void;
  debug?(message: string): void;
}

/** The slice of `electron-updater`'s `autoUpdater` the unit uses. */
export interface Updater {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  logger: UpdaterLogger | null;
  checkForUpdates(): Promise<UpdateCheckResult>;
  quitAndInstall(isSilent: boolean, isForceRunAfter: boolean): void;
  on(event: 'error', listener: (error: Error) => void): unknown;
}

export interface UpdatesWorld {
  updater: Updater;
  /** Main passes `mode === 'installed'`; every other **Shell mode** is off. */
  enabled: boolean;
  now: () => Date;
  /** The server's **Ordered shutdown**, its budget bound by main. */
  shutdown: () => Promise<void>;
  /** Every status change, whole — main sends it to the window. */
  onStatus: (status: UpdateStatus) => void;
  /** The **Shell log**'s `main` writer. */
  log: (text: string) => void;
}

export interface Updates {
  /** The launch check: silent on a refusal, never rejecting, nothing when disabled. */
  start(): Promise<void>;
  /** The status now. */
  current(): UpdateStatus;
  /** The pressed check, which always answers. */
  check(): Promise<UpdateCheck>;
  /** Install the offer now; nothing with no offer. */
  install(): void;
}

const text = (message: unknown): string =>
  message instanceof Error ? message.message : String(message);

/**
 * Main's injected domain over `electron-updater`, the `serverHandle`
 * precedent: everything it touches comes in through its world. It leaves
 * `autoDownload` and `autoInstallOnAppQuit` at their defaults — on — always
 * listens for `error` (an unlistened one throws in main), and logs the
 * updater's info, warn and error, dropping debug.
 */
export function createUpdates(world: UpdatesWorld): Updates {
  const { updater, enabled, now, onStatus, log } = world;
  let status: UpdateStatus = {
    offered: null,
    lastCheckedAt: null,
    installing: false,
  };

  updater.logger = {
    info: (message) => log(`Updater: ${text(message)}`),
    warn: (message) => log(`Updater warning: ${text(message)}`),
    error: (message) => log(`Updater error: ${text(message)}`),
    debug: () => undefined,
  };

  updater.on('error', (error) => {
    log(`Update error: ${text(error)}`);
  });

  /** One check against the feed: its outcome, or `refused`. */
  async function runCheck(): Promise<UpdateCheck> {
    let result: UpdateCheckResult;
    try {
      result = await updater.checkForUpdates();
    } catch {
      return 'refused';
    }
    if (result === null) return 'refused';

    status = { ...status, lastCheckedAt: now().toISOString() };
    onStatus(status);
    return result.isUpdateAvailable ? 'found' : 'none';
  }

  return {
    async start() {
      if (!enabled) return;
      await runCheck();
    },
    current: () => status,
    check() {
      if (!enabled) return Promise.resolve('unavailable');
      return runCheck();
    },
    install() {
      // Nothing can be offered until `update-downloaded` is listened for.
    },
  };
}
