// @vitest-environment node
//
// Issue #226 — loading until Vite answers is a unit. `loadRenderer` calls the
// window's `loadURL`, asks again every 500 ms while it rejects, and stops
// asking once it resolves or the window is destroyed. On fake timers, over a
// fake window; Electron is never launched.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadRenderer,
  RENDERER_RETRY_MS,
  type RendererTarget,
} from './loadRenderer';

const VITE_URL = 'http://localhost:4200/';

/** A window whose loads reject `refusals` times, then resolve. */
function window(refusals: number) {
  let destroyed = false;
  let asked = 0;
  const target = {
    loadURL: vi.fn((_url: string) => {
      asked += 1;
      return asked <= refusals
        ? Promise.reject(new Error('ERR_CONNECTION_REFUSED'))
        : Promise.resolve();
    }),
    isDestroyed: () => destroyed,
    destroy: () => {
      destroyed = true;
    },
  } satisfies RendererTarget & { destroy: () => void };
  return target;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loadRenderer', () => {
  it('loads the url once when it answers first time', async () => {
    const target = window(0);

    loadRenderer(target, VITE_URL);
    await vi.advanceTimersByTimeAsync(RENDERER_RETRY_MS * 4);

    expect(target.loadURL).toHaveBeenCalledTimes(1);
    expect(target.loadURL).toHaveBeenCalledWith(VITE_URL);
  });

  it('asks again every 500 ms while the load rejects', async () => {
    const target = window(Infinity);

    loadRenderer(target, VITE_URL);
    await vi.advanceTimersByTimeAsync(0);
    expect(target.loadURL).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(499);
    expect(target.loadURL).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(target.loadURL).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(500);
    expect(target.loadURL).toHaveBeenCalledTimes(3);
  });

  it('stops asking once a load resolves', async () => {
    const target = window(2);

    loadRenderer(target, VITE_URL);
    await vi.advanceTimersByTimeAsync(RENDERER_RETRY_MS * 10);

    expect(target.loadURL).toHaveBeenCalledTimes(3);
  });

  it('stops asking once the window is destroyed', async () => {
    const target = window(Infinity);

    loadRenderer(target, VITE_URL);
    await vi.advanceTimersByTimeAsync(RENDERER_RETRY_MS);
    expect(target.loadURL).toHaveBeenCalledTimes(2);

    target.destroy();
    await vi.advanceTimersByTimeAsync(RENDERER_RETRY_MS * 10);

    expect(target.loadURL).toHaveBeenCalledTimes(2);
  });

  it('never asks a window destroyed before its first load', async () => {
    const target = window(0);
    target.destroy();

    loadRenderer(target, VITE_URL);
    await vi.advanceTimersByTimeAsync(RENDERER_RETRY_MS * 4);

    expect(target.loadURL).not.toHaveBeenCalled();
  });
});
