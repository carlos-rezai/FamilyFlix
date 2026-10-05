// @vitest-environment node
//
// Issue #236 — Software update, the tracer bullet. `createUpdates(world)` is
// main's injected domain over `electron-updater`'s `autoUpdater`, the
// `serverHandle` precedent: everything it touches comes in through its world,
// so the real `autoUpdater` is never read and Electron is never launched.
//
// `start()` is the once-per-launch check — silent on a refusal, never
// rejecting, and nothing at all when disabled (every **Shell mode** but
// `installed`). `check()` is the pressed check, which always answers:
// `unavailable` when disabled, `refused` on a rejection or a `null` result,
// and otherwise `none` or `found` by `isUpdateAvailable` alone. Only a check
// that got an answer moves `lastCheckedAt`. An `error` event with no listener
// throws in main, so one is always registered; and the updater's logger
// writes info, warn and error to the **Shell log** and drops debug.

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { UpdateStatus } from '../../src/types/update';
import {
  createUpdates,
  type Updater,
  type UpdatesWorld,
} from './createUpdates';

type CheckResult = Awaited<ReturnType<Updater['checkForUpdates']>>;

/** A fake `autoUpdater`: its two flags left at electron-updater's defaults. */
function fakeUpdater() {
  const listeners = new Map<string, ((payload: never) => void)[]>();
  let answer: () => Promise<CheckResult> = () =>
    Promise.resolve({
      isUpdateAvailable: false,
      updateInfo: { version: '0.1.0' },
    });

  const updater = {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    logger: null as Updater['logger'],
    checkForUpdates: vi.fn(() => answer()),
    quitAndInstall:
      vi.fn<(isSilent: boolean, isForceRunAfter: boolean) => void>(),
    on(event: string, listener: (payload: never) => void) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      return updater;
    },
  };

  return {
    updater: updater as unknown as Updater & typeof updater,
    /** What the next `checkForUpdates()` settles with. */
    answers(next: () => Promise<CheckResult>) {
      answer = next;
    },
    /** Fire an event the way `autoUpdater` does; throws with no listener, as main would. */
    emit(event: string, payload: unknown) {
      const registered = listeners.get(event) ?? [];
      if (registered.length === 0) {
        throw new Error(`Unhandled ${event} event`);
      }
      for (const listener of registered) listener(payload as never);
    },
    listenerCount: (event: string) => (listeners.get(event) ?? []).length,
  };
}

const NOW = new Date('2026-10-05T09:30:00.000Z');
const EARLIER = new Date('2026-10-05T08:00:00.000Z');

const found = (version: string): CheckResult => ({
  isUpdateAvailable: true,
  updateInfo: { version },
});
const nothingNew = (version: string): CheckResult => ({
  isUpdateAvailable: false,
  updateInfo: { version },
});

function setup(overrides: Partial<UpdatesWorld> = {}) {
  const fake = fakeUpdater();
  const onStatus = vi.fn<(status: UpdateStatus) => void>();
  const log = vi.fn<(text: string) => void>();
  const now = vi.fn(() => NOW);
  const world: UpdatesWorld = {
    updater: fake.updater,
    enabled: true,
    now,
    shutdown: () => Promise.resolve(),
    onStatus,
    log,
    ...overrides,
  };
  const updates = createUpdates(world);
  return { fake, updates, onStatus, log, now };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createUpdates — before anything happens', () => {
  it('holds no offer, no check and no install', () => {
    const { updates } = setup();

    expect(updates.current()).toEqual({
      offered: null,
      lastCheckedAt: null,
      installing: false,
    });
  });

  it('leaves autoDownload and autoInstallOnAppQuit on', () => {
    const { fake } = setup();

    expect(fake.updater.autoDownload).toBe(true);
    expect(fake.updater.autoInstallOnAppQuit).toBe(true);
  });

  it('leaves them on when disabled too', () => {
    const { fake } = setup({ enabled: false });

    expect(fake.updater.autoDownload).toBe(true);
    expect(fake.updater.autoInstallOnAppQuit).toBe(true);
  });
});

describe('createUpdates — the launch check', () => {
  it('checks once when enabled', async () => {
    const { fake, updates } = setup();

    await updates.start();

    expect(fake.updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('never checks when disabled', async () => {
    const { fake, updates } = setup({ enabled: false });

    await updates.start();

    expect(fake.updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('never rejects when the check rejects, and pushes nothing', async () => {
    const { fake, updates, onStatus } = setup();
    fake.answers(() =>
      Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED'))
    );

    await expect(updates.start()).resolves.toBeUndefined();
    expect(onStatus).not.toHaveBeenCalled();
    expect(updates.current().lastCheckedAt).toBeNull();
  });

  it('never rejects on a null result, and pushes nothing', async () => {
    const { fake, updates, onStatus } = setup();
    fake.answers(() => Promise.resolve(null));

    await expect(updates.start()).resolves.toBeUndefined();
    expect(onStatus).not.toHaveBeenCalled();
    expect(updates.current().lastCheckedAt).toBeNull();
  });
});

describe('createUpdates — the pressed check', () => {
  it('answers unavailable when disabled, without checking', async () => {
    const { fake, updates } = setup({ enabled: false });

    await expect(updates.check()).resolves.toBe('unavailable');
    expect(fake.updater.checkForUpdates).not.toHaveBeenCalled();
    expect(updates.current().lastCheckedAt).toBeNull();
  });

  it('answers none when the feed has nothing newer, and stamps lastCheckedAt', async () => {
    const { fake, updates } = setup();
    fake.answers(() => Promise.resolve(nothingNew('0.1.0')));

    await expect(updates.check()).resolves.toBe('none');
    expect(updates.current().lastCheckedAt).toBe(NOW.toISOString());
  });

  it('answers found when an update is available, and stamps lastCheckedAt', async () => {
    const { fake, updates } = setup();
    fake.answers(() => Promise.resolve(found('0.2.0')));

    await expect(updates.check()).resolves.toBe('found');
    expect(updates.current().lastCheckedAt).toBe(NOW.toISOString());
  });

  it('reads isUpdateAvailable, never the version', async () => {
    const { fake, updates } = setup();
    fake.answers(() => Promise.resolve(nothingNew('9.9.9')));

    await expect(updates.check()).resolves.toBe('none');
  });

  it('pushes the whole status when lastCheckedAt moves', async () => {
    const { fake, updates, onStatus } = setup();
    fake.answers(() => Promise.resolve(nothingNew('0.1.0')));

    await updates.check();

    expect(onStatus).toHaveBeenLastCalledWith({
      offered: null,
      lastCheckedAt: NOW.toISOString(),
      installing: false,
    });
  });

  it('answers refused on a rejection, and leaves lastCheckedAt alone', async () => {
    const { fake, updates } = setup();
    fake.answers(() => Promise.reject(new Error('net::ERR_NAME_NOT_RESOLVED')));

    await expect(updates.check()).resolves.toBe('refused');
    expect(updates.current().lastCheckedAt).toBeNull();
  });

  it('answers refused on a null result, and leaves lastCheckedAt alone', async () => {
    const { fake, updates } = setup();
    fake.answers(() => Promise.resolve(null));

    await expect(updates.check()).resolves.toBe('refused');
    expect(updates.current().lastCheckedAt).toBeNull();
  });

  it('keeps the last answered stamp through a later refusal', async () => {
    const now = vi.fn(() => EARLIER);
    const { fake, updates } = setup({ now });
    fake.answers(() => Promise.resolve(nothingNew('0.1.0')));
    await updates.check();

    now.mockReturnValue(NOW);
    fake.answers(() => Promise.reject(new Error('offline')));
    await expect(updates.check()).resolves.toBe('refused');

    fake.answers(() => Promise.resolve(null));
    await expect(updates.check()).resolves.toBe('refused');

    expect(updates.current().lastCheckedAt).toBe(EARLIER.toISOString());
  });
});

describe('createUpdates — the error event', () => {
  it('is always listened for, enabled or not', () => {
    expect(setup().fake.listenerCount('error')).toBeGreaterThan(0);
    expect(
      setup({ enabled: false }).fake.listenerCount('error')
    ).toBeGreaterThan(0);
  });

  it('logs one line naming the error, and changes nothing', () => {
    const { fake, updates, onStatus, log } = setup();
    const before = updates.current();

    fake.emit('error', new Error('Cannot find latest.yml'));

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('Cannot find latest.yml');
    expect(onStatus).not.toHaveBeenCalled();
    expect(updates.current()).toEqual(before);
  });
});

describe('createUpdates — the logger', () => {
  it('is installed on the updater', () => {
    const { fake } = setup();

    expect(fake.updater.logger).not.toBeNull();
  });

  it('writes info, warn and error to the Shell log', () => {
    const { fake, log } = setup();
    const logger = fake.updater.logger;

    logger?.info('Checking for update');
    logger?.warn('Signature verification is off');
    logger?.error('Download failed');

    const lines = log.mock.calls.map(([text]) => text).join('\n');
    expect(lines).toContain('Checking for update');
    expect(lines).toContain('Signature verification is off');
    expect(lines).toContain('Download failed');
  });

  it('drops debug', () => {
    const { fake, log } = setup();
    const logger = fake.updater.logger as
      | (Updater['logger'] & { debug?: (message: string) => void })
      | null;

    logger?.debug?.('updater cache dir: C:\\noise');

    expect(log.mock.calls.map(([text]) => text).join('\n')).not.toContain(
      'noise'
    );
  });
});
