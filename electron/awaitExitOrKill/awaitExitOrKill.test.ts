// @vitest-environment node
//
// Issue #217 — the ordered shutdown. `awaitExitOrKill(child, ms)` is how main
// waits out the server's **Ordered shutdown** on `before-quit`: it resolves
// when the child exits within `ms`, and at the deadline it kills the child and
// resolves anyway, so quitting never hangs on a server that will not stop.
//
// The fake child stands in for a `UtilityProcess`: it emits `exit` with a
// code, and records `kill()`. Electron is never launched.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeServerChild } from '../test-support/fakeServerChild/fakeServerChild';
import { awaitExitOrKill } from './awaitExitOrKill';

let child: FakeServerChild;

beforeEach(() => {
  vi.useFakeTimers();
  child = new FakeServerChild();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('awaitExitOrKill', () => {
  it('resolves when the child exits in time, without killing it', async () => {
    const waited = awaitExitOrKill(child, 5_000);
    const settled = vi.fn();
    waited.then(settled, settled);

    await vi.advanceTimersByTimeAsync(1_200);
    child.exit(0);
    await vi.advanceTimersByTimeAsync(0);

    expect(settled).toHaveBeenCalled();
    await expect(waited).resolves.toBeUndefined();
    expect(child.kill).not.toHaveBeenCalled();
  });

  it('does not kill a child that exited, even once the deadline passes', async () => {
    const waited = awaitExitOrKill(child, 5_000);
    child.exit(0);
    await waited;

    await vi.advanceTimersByTimeAsync(10_000);

    expect(child.kill).not.toHaveBeenCalled();
  });

  it('waits until the deadline before killing', async () => {
    const waited = awaitExitOrKill(child, 5_000);
    const settled = vi.fn();
    waited.then(settled, settled);

    await vi.advanceTimersByTimeAsync(4_999);

    expect(child.kill).not.toHaveBeenCalled();
    expect(settled).not.toHaveBeenCalled();
  });

  it('kills the child at the deadline and resolves', async () => {
    const waited = awaitExitOrKill(child, 5_000);

    await vi.advanceTimersByTimeAsync(5_000);

    expect(child.kill).toHaveBeenCalledTimes(1);
    await expect(waited).resolves.toBeUndefined();
  });
});
