import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useBrowseLoad } from './useBrowseLoad';

/** A payload that says which load produced it, so a stale one is recognisable. */
interface Payload {
  from: string;
}

/**
 * A load whose promise is resolved by the test rather than by a timer, so
 * "still in flight" is a state the assertions can hold the hook in.
 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useBrowseLoad', () => {
  it('starts on the skeleton and lands on what the load returned', async () => {
    const { result } = renderHook(() =>
      useBrowseLoad(() => Promise.resolve<Payload>({ from: 'first' }), 'first')
    );

    expect(result.current.status).toBe('loading');
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data).toEqual({ from: 'first' });
  });

  it('reloads when the key changes, and not when it does not', async () => {
    const load = vi.fn(() => Promise.resolve<Payload>({ from: 'any' }));
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => useBrowseLoad(load, key),
      { initialProps: { key: 'a' } }
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(load).toHaveBeenCalledTimes(1);

    // The same query, re-rendered: the fetcher is a new closure every time, and
    // none of that is a reason to ask the server again.
    rerender({ key: 'a' });
    rerender({ key: 'a' });
    expect(load).toHaveBeenCalledTimes(1);

    rerender({ key: 'b' });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it('keeps a ready screen ready through a refetch, rather than flashing the skeleton', async () => {
    const pending = deferred<Payload>();
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) =>
        useBrowseLoad(
          () =>
            key === 'a' ? Promise.resolve({ from: 'a' }) : pending.promise,
          key
        ),
      { initialProps: { key: 'a' } }
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ key: 'b' });

    // The latch: a second load is in flight, and what is already painted stays.
    expect(result.current.status).toBe('ready');
    expect(result.current.data).toEqual({ from: 'a' });

    await act(async () => {
      pending.resolve({ from: 'b' });
    });
    expect(result.current.data).toEqual({ from: 'b' });
  });

  it('falls back to the skeleton for a load with nothing on screen behind it', async () => {
    const pending = deferred<Payload>();
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) =>
        useBrowseLoad(
          () =>
            key === 'a' ? Promise.reject(new Error('nope')) : pending.promise,
          key
        ),
      { initialProps: { key: 'a' } }
    );

    await waitFor(() => expect(result.current.status).toBe('error'));

    rerender({ key: 'b' });

    // Nothing was painted, so there is nothing to keep: the skeleton is right.
    expect(result.current.status).toBe('loading');

    await act(async () => {
      pending.resolve({ from: 'b' });
    });
    expect(result.current.status).toBe('ready');
  });

  it('never lets an abandoned load overwrite the one that replaced it', async () => {
    const first = deferred<Payload>();
    const second = deferred<Payload>();
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) =>
        useBrowseLoad(
          () => (key === 'first' ? first.promise : second.promise),
          key
        ),
      { initialProps: { key: 'first' } }
    );

    rerender({ key: 'second' });

    // The newer load answers first; the older one is already disowned.
    await act(async () => {
      second.resolve({ from: 'second' });
    });
    expect(result.current.data).toEqual({ from: 'second' });

    await act(async () => {
      first.resolve({ from: 'first' });
    });
    expect(result.current.data).toEqual({ from: 'second' });
    expect(result.current.status).toBe('ready');
  });

  it('does not let an abandoned failure error a screen that has since loaded', async () => {
    const first = deferred<Payload>();
    const second = deferred<Payload>();
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) =>
        useBrowseLoad(
          () => (key === 'first' ? first.promise : second.promise),
          key
        ),
      { initialProps: { key: 'first' } }
    );

    rerender({ key: 'second' });

    await act(async () => {
      second.resolve({ from: 'second' });
    });
    await act(async () => {
      first.reject(new Error('the abandoned one failed'));
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.data).toEqual({ from: 'second' });
  });

  it('reports a failure and shows nothing behind it', async () => {
    const { result } = renderHook(() =>
      useBrowseLoad<Payload>(() => Promise.reject(new Error('down')), 'k')
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBeNull();
  });

  it('drops what it was showing when a reload of the same screen fails', async () => {
    let fail = false;
    const { result } = renderHook(() =>
      useBrowseLoad<Payload>(
        () =>
          fail
            ? Promise.reject(new Error('down'))
            : Promise.resolve({ from: 'first' }),
        'k'
      )
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));

    fail = true;
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBeNull();
  });

  it('re-runs a failed load when retry is pressed, and succeeds the second time', async () => {
    let fail = true;
    const load = vi.fn(() =>
      fail
        ? Promise.reject(new Error('down'))
        : Promise.resolve<Payload>({ from: 'second' })
    );
    const { result } = renderHook(() => useBrowseLoad(load, 'k'));

    await waitFor(() => expect(result.current.status).toBe('error'));

    fail = false;
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data).toEqual({ from: 'second' });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('lets a caller edit what was loaded, without asking for it again', async () => {
    const load = vi.fn(() => Promise.resolve<Payload>({ from: 'loaded' }));
    const { result } = renderHook(() => useBrowseLoad(load, 'k'));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => result.current.setData({ from: 'edited' }));

    expect(result.current.data).toEqual({ from: 'edited' });
    expect(result.current.status).toBe('ready');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("replaces an edit with the next load's answer", async () => {
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) =>
        useBrowseLoad(() => Promise.resolve<Payload>({ from: key }), key),
      { initialProps: { key: 'a' } }
    );

    await waitFor(() => expect(result.current.data).toEqual({ from: 'a' }));
    act(() => result.current.setData({ from: 'edited' }));

    rerender({ key: 'b' });

    await waitFor(() => expect(result.current.data).toEqual({ from: 'b' }));
  });

  it('keeps one retry identity, so a consumer memoised on it does not churn', async () => {
    const { result } = renderHook(() =>
      useBrowseLoad(() => Promise.resolve<Payload>({ from: 'any' }), 'k')
    );
    const first = result.current.retry;

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.retry).toBe(first);
  });
});
