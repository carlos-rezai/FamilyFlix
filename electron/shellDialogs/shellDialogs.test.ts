// @vitest-environment node
//
// Issue #224 — failures and logs. When something breaks, the family always has
// something to press.
//
// - The startup dialog, "FamilyFlix couldn't start.", carries the error as its
//   detail and offers Quit and Show data folder. `startServer` puts every one
//   of the three startup failures `serverHandle` rejects on — a `fatal`, the
//   15 s timeout, an exit before `ready` — in front of it; Show data folder
//   opens `userData`.
// - After `ready`, an unexpected exit offers Restart (`app.relaunch()`, then
//   exit) and Quit.
//
// Electron's `dialog`, `shell.openPath` and `app` are injected; the server is
// the real `serverHandle` over a fake child, the way its own suite drives it.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { serverHandle } from '../serverHandle/serverHandle';
import type { ServerLaunch } from '../serverLaunch/serverLaunch';
import { FakeServerChild } from '../test-support/fakeServerChild/fakeServerChild';
import {
  startServer,
  startupFailed,
  stoppedUnexpectedly,
  type DialogWorld,
  type MessageBox,
} from './shellDialogs';

const LAUNCH: ServerLaunch = {
  entry: 'server/dist/server.js',
  execArgv: [],
  env: { PORT: '41720' },
};

const USER_DATA = 'C:\\Users\\Mum\\AppData\\Roaming\\FamilyFlix';

/**
 * A world whose dialog answers by pressing the button labelled `press`, and
 * records every box it was shown and every step it took, in order.
 */
function world(press: string) {
  const boxes: MessageBox[] = [];
  const order: string[] = [];
  const fake = {
    boxes,
    order,
    userData: USER_DATA,
    showMessageBox: vi.fn(async (box: MessageBox) => {
      boxes.push(box);
      const response = box.buttons.indexOf(press);
      if (response < 0) throw new Error(`No ${press} button`);
      return { response };
    }),
    openPath: vi.fn(async (path: string) => {
      order.push(`openPath ${path}`);
      return '';
    }),
    relaunch: vi.fn(() => {
      order.push('relaunch');
    }),
    exit: vi.fn((code: number) => {
      order.push(`exit ${code}`);
    }),
  } satisfies DialogWorld & { boxes: MessageBox[]; order: string[] };
  return fake;
}

function failingStart() {
  const child = new FakeServerChild();
  const server = serverHandle({
    fork: () => child,
    launch: LAUNCH,
    onExit: vi.fn(),
  });
  return { child, server };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('startupFailed — the startup dialog', () => {
  it('says FamilyFlix couldn’t start, with the error as its detail', async () => {
    const w = world('Quit');

    await startupFailed(w, new Error('SQLITE_CANTOPEN: unable to open'));

    expect(w.boxes).toHaveLength(1);
    expect(w.boxes[0].message).toBe('FamilyFlix couldn’t start.');
    expect(w.boxes[0].detail).toBe('SQLITE_CANTOPEN: unable to open');
    expect(w.boxes[0].buttons).toEqual(['Quit', 'Show data folder']);
  });

  it('Quit leaves without opening anything', async () => {
    const w = world('Quit');

    await startupFailed(w, new Error('boom'));

    expect(w.openPath).not.toHaveBeenCalled();
    expect(w.relaunch).not.toHaveBeenCalled();
    expect(w.exit).toHaveBeenCalledTimes(1);
  });

  it('Show data folder opens userData, then leaves', async () => {
    const w = world('Show data folder');

    await startupFailed(w, new Error('boom'));

    expect(w.openPath).toHaveBeenCalledWith(USER_DATA);
    expect(w.order[0]).toBe(`openPath ${USER_DATA}`);
    expect(w.exit).toHaveBeenCalledTimes(1);
    expect(w.relaunch).not.toHaveBeenCalled();
  });
});

describe('startServer — every startup failure reaches the dialog', () => {
  it('resolves with the port and shows nothing when the server is ready', async () => {
    const { child, server } = failingStart();
    const w = world('Quit');

    const started = startServer(server, w);
    child.post({ type: 'ready', port: 41720 });

    await expect(started).resolves.toEqual({ port: 41720 });
    expect(w.showMessageBox).not.toHaveBeenCalled();
    expect(w.exit).not.toHaveBeenCalled();
  });

  it('a fatal shows the dialog with the server’s own message', async () => {
    const { child, server } = failingStart();
    const w = world('Quit');

    const started = startServer(server, w);
    child.post({ type: 'fatal', message: 'EACCES: permission denied' });

    await expect(started).resolves.toBeNull();
    expect(w.boxes).toHaveLength(1);
    expect(w.boxes[0].message).toBe('FamilyFlix couldn’t start.');
    expect(w.boxes[0].detail).toBe('EACCES: permission denied');
  });

  it('the 15 s timeout shows the dialog', async () => {
    vi.useFakeTimers();
    const { server } = failingStart();
    const w = world('Quit');

    const started = startServer(server, w);
    await vi.advanceTimersByTimeAsync(15_000);

    await expect(started).resolves.toBeNull();
    expect(w.boxes).toHaveLength(1);
    expect(w.boxes[0].message).toBe('FamilyFlix couldn’t start.');
    expect(w.boxes[0].detail).toMatch(/15 s/);
  });

  it('an exit before ready shows the dialog', async () => {
    const { child, server } = failingStart();
    const w = world('Quit');

    const started = startServer(server, w);
    child.exit(3);

    await expect(started).resolves.toBeNull();
    expect(w.boxes).toHaveLength(1);
    expect(w.boxes[0].message).toBe('FamilyFlix couldn’t start.');
    expect(w.boxes[0].detail).toMatch(/code 3/);
  });

  it('Show data folder from a failed start opens userData', async () => {
    const { child, server } = failingStart();
    const w = world('Show data folder');

    const started = startServer(server, w);
    child.post({ type: 'fatal', message: 'boom' });

    await expect(started).resolves.toBeNull();
    expect(w.openPath).toHaveBeenCalledWith(USER_DATA);
    expect(w.exit).toHaveBeenCalledTimes(1);
  });
});

describe('stoppedUnexpectedly — an exit after ready', () => {
  it('says FamilyFlix stopped unexpectedly, offering Restart and Quit', async () => {
    const w = world('Quit');

    await stoppedUnexpectedly(w);

    expect(w.boxes).toHaveLength(1);
    expect(w.boxes[0].message).toBe('FamilyFlix stopped unexpectedly.');
    expect(w.boxes[0].buttons).toEqual(['Restart', 'Quit']);
  });

  it('Restart relaunches, then exits', async () => {
    const w = world('Restart');

    await stoppedUnexpectedly(w);

    expect(w.order).toEqual(['relaunch', expect.stringMatching(/^exit /)]);
  });

  it('Quit exits without relaunching', async () => {
    const w = world('Quit');

    await stoppedUnexpectedly(w);

    expect(w.relaunch).not.toHaveBeenCalled();
    expect(w.exit).toHaveBeenCalledTimes(1);
    expect(w.openPath).not.toHaveBeenCalled();
  });
});
