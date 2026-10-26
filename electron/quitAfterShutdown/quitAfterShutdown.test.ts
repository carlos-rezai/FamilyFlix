// @vitest-environment node
//
// Issue #226 — the quit gate is a unit. `quitAfterShutdown` answers main's
// `before-quit` listener: it holds the app open until the **Server process**'s
// **Ordered shutdown** is over, then quits, and lets that quit through.
//
// The shutdown is the real `serverHandle`'s over the shared fake child, so a
// server that has to be killed at the budget is the handle's own kill, on
// fake timers. Electron is never launched.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { serverHandle } from '../serverHandle/serverHandle';
import { FakeServerChild } from '../test-support/fakeServerChild/fakeServerChild';
import { quitAfterShutdown, type QuitEvent } from './quitAfterShutdown';

const BUDGET_MS = 5_000;

let child: FakeServerChild;

async function runningServer() {
  const server = serverHandle({
    fork: () => child,
    launch: { entry: 'electron/dist/server.js', env: {} },
    onExit: vi.fn(),
  });
  const started = server.start();
  child.post({ type: 'ready', port: 41720 });
  await started;
  return server;
}

function beforeQuit(): QuitEvent & { prevented: () => boolean } {
  const preventDefault = vi.fn();
  return {
    preventDefault,
    prevented: () => preventDefault.mock.calls.length > 0,
  };
}

beforeEach(() => {
  child = new FakeServerChild();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('quitAfterShutdown', () => {
  it('prevents the first before-quit and runs the shutdown', async () => {
    const server = await runningServer();
    const shutdown = vi.spyOn(server, 'shutdown');
    const quit = vi.fn();
    const listener = quitAfterShutdown({
      shutdown: server.shutdown,
      ms: BUDGET_MS,
      quit,
    });

    const event = beforeQuit();
    listener(event);

    expect(event.prevented()).toBe(true);
    expect(shutdown).toHaveBeenCalledWith(BUDGET_MS);
    expect(child.postMessage).toHaveBeenCalledWith({ type: 'shutdown' });
    expect(quit).not.toHaveBeenCalled();
  });

  it('prevents a second before-quit while stopping, and runs no second shutdown', () => {
    // A shutdown that never settles: the gate is still stopping.
    const shutdown = vi.fn(() => new Promise<void>(() => undefined));
    const listener = quitAfterShutdown({
      shutdown,
      ms: BUDGET_MS,
      quit: vi.fn(),
    });

    listener(beforeQuit());
    const second = beforeQuit();
    listener(second);

    expect(second.prevented()).toBe(true);
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it('quits once the shutdown resolves, and lets that quit through', async () => {
    const server = await runningServer();
    const quit = vi.fn();
    const listener = quitAfterShutdown({
      shutdown: server.shutdown,
      ms: BUDGET_MS,
      quit,
    });

    listener(beforeQuit());
    child.exit(0);
    await vi.waitFor(() => expect(quit).toHaveBeenCalledTimes(1));

    const again = beforeQuit();
    listener(again);

    expect(again.prevented()).toBe(false);
    expect(quit).toHaveBeenCalledTimes(1);
  });

  it('still quits when the server had to be killed at the budget', async () => {
    vi.useFakeTimers();
    const server = await runningServer();
    const quit = vi.fn();
    const listener = quitAfterShutdown({
      shutdown: server.shutdown,
      ms: BUDGET_MS,
      quit,
    });

    listener(beforeQuit());
    await vi.advanceTimersByTimeAsync(BUDGET_MS - 1);
    expect(quit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(quit).toHaveBeenCalledTimes(1);
  });
});
