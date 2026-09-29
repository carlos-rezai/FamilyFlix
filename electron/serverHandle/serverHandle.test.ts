// @vitest-environment node
//
// Issue #216 — the window over the server. `serverHandle` is main's hold on
// the **Server process**, with `utilityProcess.fork()` injected: `start()`
// forks the server and waits for the **Shell handshake**'s `ready`, resolving
// with the port the server reported. It rejects on `fatal` with the server's
// own message, at the 15 s timeout, and when the process exits before `ready`.
// An exit after `ready` is a crash of a running app, and goes to `onExit`.
//
// The fake child stands in for a `UtilityProcess`: it emits `message` with the
// message itself as the payload and `exit` with a code, the way Electron's
// does. Electron is never launched.

import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ServerMessage } from '../../src/types/shell';
import type { ServerLaunch } from '../serverLaunch/serverLaunch';
import { serverHandle, type ServerChild } from './serverHandle';

class FakeChild extends EventEmitter implements ServerChild {
  readonly postMessage = vi.fn();
  readonly kill = vi.fn(() => true);

  post(message: ServerMessage): void {
    this.emit('message', message);
  }

  exit(code: number): void {
    this.emit('exit', code);
  }
}

const LAUNCH: ServerLaunch = {
  entry: 'server/src/main.ts',
  execArgv: ['--import', 'tsx'],
  env: { PORT: '3001' },
};

let child: FakeChild;
let onExit: ReturnType<typeof vi.fn<(code: number) => void>>;

const handle = () =>
  serverHandle({ fork: () => child, launch: LAUNCH, onExit });

beforeEach(() => {
  child = new FakeChild();
  onExit = vi.fn<(code: number) => void>();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('serverHandle — start', () => {
  it('resolves with the port the server reported in ready', async () => {
    const started = handle().start();

    child.post({ type: 'ready', port: 53117 });

    await expect(started).resolves.toEqual({ port: 53117 });
  });

  it('rejects with the server’s own message on fatal', async () => {
    const started = handle().start();

    child.post({ type: 'fatal', message: 'SQLITE_CANTOPEN: unable to open' });

    await expect(started).rejects.toThrow('SQLITE_CANTOPEN: unable to open');
  });

  it('rejects when ready has not come within 15 s', async () => {
    vi.useFakeTimers();
    const started = handle().start();
    const settled = vi.fn();
    started.then(settled, settled);

    await vi.advanceTimersByTimeAsync(14_999);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await expect(started).rejects.toThrow();
  });

  it('rejects when the server exits before ready', async () => {
    const started = handle().start();

    child.exit(1);

    await expect(started).rejects.toThrow();
    expect(onExit).not.toHaveBeenCalled();
  });
});

describe('serverHandle — after ready', () => {
  it('hands an exit to onExit, with its code', async () => {
    const started = handle().start();
    child.post({ type: 'ready', port: 3001 });
    await started;

    child.exit(3);

    expect(onExit).toHaveBeenCalledWith(3);
  });

  it('does not reject at the timeout once ready has come', async () => {
    vi.useFakeTimers();
    const started = handle().start();
    child.post({ type: 'ready', port: 3001 });

    await vi.advanceTimersByTimeAsync(20_000);

    await expect(started).resolves.toEqual({ port: 3001 });
  });
});
