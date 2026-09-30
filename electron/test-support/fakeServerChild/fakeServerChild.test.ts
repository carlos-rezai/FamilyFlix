// @vitest-environment node
//
// Issue #226 — the shared double. `FakeServerChild` is the server child the
// shell's suites drive main's units over: what main posts and kills is
// recorded, and a handshake message or an exit is delivered on cue.

import { describe, expect, it, vi } from 'vitest';

import { FakeServerChild } from './fakeServerChild';

describe('FakeServerChild', () => {
  it('records what main posts to it', () => {
    const child = new FakeServerChild();

    child.postMessage({ type: 'shutdown' });

    expect(child.postMessage).toHaveBeenCalledWith({ type: 'shutdown' });
  });

  it('records a kill, answering true as Electron does', () => {
    const child = new FakeServerChild();

    expect(child.kill()).toBe(true);
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it('delivers a handshake message with the message itself as the payload', () => {
    const child = new FakeServerChild();
    const heard = vi.fn();
    child.on('message', heard);

    child.post({ type: 'ready', port: 41720 });

    expect(heard).toHaveBeenCalledWith({ type: 'ready', port: 41720 });
  });

  it('emits an exit with its code, to on and once alike', () => {
    const child = new FakeServerChild();
    const on = vi.fn();
    const once = vi.fn();
    child.on('exit', on);
    child.once('exit', once);

    child.exit(3);
    child.exit(4);

    expect(on).toHaveBeenNthCalledWith(1, 3);
    expect(on).toHaveBeenNthCalledWith(2, 4);
    expect(once).toHaveBeenCalledTimes(1);
    expect(once).toHaveBeenCalledWith(3);
  });
});
