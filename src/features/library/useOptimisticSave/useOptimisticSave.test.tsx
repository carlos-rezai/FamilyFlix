import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useOptimisticSave } from './useOptimisticSave';

/** A save the test resolves itself, so "not yet answered" is a state to assert in. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useOptimisticSave', () => {
  it('shows the new value before the save has answered', () => {
    const apply = vi.fn();
    const pending = deferred<boolean>();
    const { result } = renderHook(() =>
      useOptimisticSave(apply, () => pending.promise)
    );

    act(() => result.current('m1', true));

    expect(apply).toHaveBeenCalledExactlyOnceWith('m1', true);
  });

  it('leaves the shown value alone when the route echoes what was assumed', async () => {
    const apply = vi.fn();
    const save = vi.fn(() => Promise.resolve(true));
    const { result } = renderHook(() => useOptimisticSave(apply, save));

    await act(async () => result.current('m1', true));

    expect(save).toHaveBeenCalledExactlyOnceWith('m1', true);
    expect(apply).toHaveBeenCalledExactlyOnceWith('m1', true);
  });

  it('takes the route’s echo over what was assumed when the two disagree', async () => {
    const apply = vi.fn();
    const { result } = renderHook(() =>
      useOptimisticSave(apply, () => Promise.resolve(false))
    );

    await act(async () => result.current('m1', true));

    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenLastCalledWith('m1', false);
  });

  it('puts the old value back when the save is refused', async () => {
    const apply = vi.fn();
    const { result } = renderHook(() =>
      useOptimisticSave(apply, () => Promise.reject(new Error('refused')))
    );

    await act(async () => result.current('m1', true));

    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenLastCalledWith('m1', false);
  });

  it('puts a cleared flag back on too, not just a set one', async () => {
    const apply = vi.fn();
    const { result } = renderHook(() =>
      useOptimisticSave(apply, () => Promise.reject(new Error('refused')))
    );

    await act(async () => result.current('m1', false));

    expect(apply).toHaveBeenLastCalledWith('m1', true);
  });

  it('reverts only after the failure lands, not before', async () => {
    const apply = vi.fn();
    const pending = deferred<boolean>();
    const { result } = renderHook(() =>
      useOptimisticSave(apply, () => pending.promise)
    );

    act(() => result.current('m1', true));
    expect(apply).toHaveBeenCalledExactlyOnceWith('m1', true);

    await act(async () => {
      pending.reject(new Error('refused'));
    });

    await waitFor(() => expect(apply).toHaveBeenCalledTimes(2));
    expect(apply).toHaveBeenLastCalledWith('m1', false);
  });

  it('keeps one identity while its two functions keep theirs', () => {
    const apply = vi.fn();
    const save = vi.fn(() => Promise.resolve(true));
    const { result, rerender } = renderHook(() =>
      useOptimisticSave(apply, save)
    );
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
