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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ServerLaunch } from '../serverLaunch/serverLaunch';
import { FakeServerChild } from '../test-support/fakeServerChild/fakeServerChild';
import { serverHandle } from './serverHandle';

const LAUNCH: ServerLaunch = {
  entry: 'electron/dist/server.js',
  env: { PORT: '3001' },
};

let child: FakeServerChild;
let onExit: ReturnType<typeof vi.fn<(code: number) => void>>;

const handle = () =>
  serverHandle({
    fork: () => child,
    launch: LAUNCH,
    onExit,
    trash: async () => null,
  });

beforeEach(() => {
  child = new FakeServerChild();
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

// Issue #217 — the ordered shutdown. On `before-quit` main calls
// `shutdown(ms)`: it sends the **Shell handshake**'s `shutdown` command and
// waits for the exit through `awaitExitOrKill`, killing the server at `ms`.
// An exit main asked for is a quit, not a crash, so it never reaches `onExit`.

async function running() {
  const held = handle();
  const started = held.start();
  child.post({ type: 'ready', port: 3001 });
  await started;
  return held;
}

describe('serverHandle — shutdown', () => {
  it('sends the shutdown command to the server', async () => {
    const held = await running();

    void held.shutdown(5_000);

    expect(child.postMessage).toHaveBeenCalledWith({ type: 'shutdown' });
  });

  it('resolves when the server exits, without killing it', async () => {
    const held = await running();

    const stopping = held.shutdown(5_000);
    child.exit(0);

    await expect(stopping).resolves.toBeUndefined();
    expect(child.kill).not.toHaveBeenCalled();
  });

  it('kills the server when it has not exited by the deadline', async () => {
    vi.useFakeTimers();
    const held = await running();

    const stopping = held.shutdown(5_000);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(child.kill).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(child.kill).toHaveBeenCalledTimes(1);
    await expect(stopping).resolves.toBeUndefined();
  });

  it('does not report the exit it asked for as a crash', async () => {
    const held = await running();

    const stopping = held.shutdown(5_000);
    child.exit(0);
    await stopping;

    expect(onExit).not.toHaveBeenCalled();
  });
});

// 47 — Manage library, Phase 6: "the Shell trash" (issue #412). The
// **Shell handshake** grows one exchange: the server posts
// `{ type: 'trash', id, paths }`, and main answers each with
// `{ type: 'trashed', id, failed }` — the world's `trash`, `trashItems` over
// Electron's `shell.trashItem` in `main.ts`, answering the path the Recycle
// Bin would not take, else `null`. A shutdown with a request in flight still
// completes.

/** A trash the test answers by hand: each call held until released. */
function heldTrash() {
  const calls: { paths: string[]; answer: (failed: string | null) => void }[] =
    [];
  const trash = vi.fn(
    (paths: string[]) =>
      new Promise<string | null>((resolve) => {
        calls.push({ paths, answer: resolve });
      })
  );
  return { trash, calls };
}

async function runningWith(trash: (paths: string[]) => Promise<string | null>) {
  const held = serverHandle({
    fork: () => child,
    launch: LAUNCH,
    onExit,
    trash,
  });
  const started = held.start();
  child.post({ type: 'ready', port: 3001 });
  await started;
  return held;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('serverHandle — the Shell trash', () => {
  it('hands a trash request’s paths to the world’s trash', async () => {
    const { trash, calls } = heldTrash();
    await runningWith(trash);

    child.post({
      type: 'trash',
      id: 'req-1',
      paths: ['D:\\Movies\\Coco (2017)'],
    });

    expect(calls.map(({ paths }) => paths)).toEqual([
      ['D:\\Movies\\Coco (2017)'],
    ]);
  });

  it('answers a trash request with a trashed command carrying its id', async () => {
    const { trash, calls } = heldTrash();
    await runningWith(trash);

    child.post({ type: 'trash', id: 'req-1', paths: ['D:\\Movies\\Coco'] });
    calls[0].answer(null);
    await flush();

    expect(child.postMessage).toHaveBeenCalledWith({
      type: 'trashed',
      id: 'req-1',
      failed: null,
    });
  });

  it('carries the path the Recycle Bin would not take as failed', async () => {
    const { trash, calls } = heldTrash();
    await runningWith(trash);

    child.post({
      type: 'trash',
      id: 'req-7',
      paths: ['D:\\Shows\\E01.mkv', 'D:\\Shows\\E02.mkv'],
    });
    calls[0].answer('D:\\Shows\\E02.mkv');
    await flush();

    expect(child.postMessage).toHaveBeenCalledWith({
      type: 'trashed',
      id: 'req-7',
      failed: 'D:\\Shows\\E02.mkv',
    });
  });

  it('answers each of two requests by its own id, in the order they finish', async () => {
    const { trash, calls } = heldTrash();
    await runningWith(trash);

    child.post({ type: 'trash', id: 'first', paths: ['D:\\A'] });
    child.post({ type: 'trash', id: 'second', paths: ['D:\\B'] });
    calls[1].answer(null);
    await flush();
    calls[0].answer('D:\\A');
    await flush();

    const answered = child.postMessage.mock.calls.map(([message]) => message);
    expect(answered).toEqual([
      { type: 'trashed', id: 'second', failed: null },
      { type: 'trashed', id: 'first', failed: 'D:\\A' },
    ]);
  });

  it('is not taken for ready while the server is starting', async () => {
    const { trash } = heldTrash();
    const held = serverHandle({
      fork: () => child,
      launch: LAUNCH,
      onExit,
      trash,
    });
    const started = held.start();

    child.post({ type: 'trash', id: 'early', paths: ['D:\\A'] });
    child.post({ type: 'ready', port: 41720 });

    await expect(started).resolves.toEqual({ port: 41720 });
  });

  it('completes a shutdown with a request still in flight', async () => {
    const { trash, calls } = heldTrash();
    const held = await runningWith(trash);
    child.post({ type: 'trash', id: 'req-1', paths: ['D:\\Movies\\Coco'] });

    const stopping = held.shutdown(5_000);
    child.exit(0);

    await expect(stopping).resolves.toBeUndefined();
    expect(child.postMessage).toHaveBeenCalledWith({ type: 'shutdown' });
    expect(child.kill).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();

    calls[0].answer(null);
    await flush();
    expect(child.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'trashed' })
    );
  });
});
