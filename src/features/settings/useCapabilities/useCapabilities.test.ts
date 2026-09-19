import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useCapabilities } from './useCapabilities';
import type { PlaybackCapabilities } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 15 — Settings hub, Phase 1: "the tracer bullet" (issue #143).
 *
 * `useCapabilities()` → `{ capabilities }`: the **Codec report** the
 * `CodecManager` draws, fetched once on mount. **Blank until it lands** — the
 * Export summary's rule, and the shape every read on the Settings page
 * repeats: `null` until the read lands, the payload after, and `null` still if
 * it never does. No skeleton, no error face, no snackbar — the prototype draws
 * none, and a hook that did more would be a test suite written twice.
 *
 * Everything is asserted as requests against a stubbed `fetch` and what the
 * hook hands back.
 *
 * 16 — Playback component upload, Phase 3: "the zone" (issue #154). The hook
 * grows the write that changes what it read:
 * `{ capabilities, upload, installComponent }` — the read and the write in one
 * hook, on the `useSettings` precedent, so the state the write echoes is the
 * state the read holds. Nothing re-fetches: `POST /api/playback/component`
 * answers the **Codec report** after the swap, and that echo *is* the redraw.
 * The **Upload state** is `idle | busy(action) | refused(reason)`. _Replaced_
 * is not one of them: the rows, the summary and the **Component row**'s pill
 * changing is the whole of the feedback, and a success flash would be a fourth
 * state saying what the third already showed.
 *
 * **Neither write rejects.** The organism draws a refusal from state and never
 * from a caught exception, so a caller that forgot to `catch` cannot turn a
 * `409` into an unhandled rejection. A refusal the route named a reason for
 * carries the route's own words; anything else — a `500`, a body that would
 * not parse, a request that never left — carries the fixed line, so silence is
 * not one of the possible answers.
 *
 * 16 — Playback component upload, Phase 4: "the ✕ takes it back" (issue
 * #155). The hook's second write, and the first one's inverse:
 * `{ capabilities, upload, installComponent, removeComponent }`. It behaves
 * the way the install does in every respect the **Upload state** can see —
 * `busy('remove')` rather than `busy('install')` while it runs, the echoed
 * report as the whole of the redraw, the route's own words on a refusal and
 * the fixed line when it named none, a call while busy ignored, and **no
 * rejection out of the hook**. **No confirmation** is asked anywhere: the ✕
 * removes immediately. The action is reversible by a drop, the files are the
 * maintainer's own download, and the **Default component** comes back
 * underneath.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const REPORT: PlaybackCapabilities = {
  component: {
    source: 'default',
    bytes: 98_765_432,
    files: ['ffmpeg.exe', 'ffprobe.exe'],
  },
  codecs: [
    { codec: 'h264', kind: 'video', support: 'native' },
    { codec: 'hevc', kind: 'video', support: 'via-component' },
  ],
};

/** A read that answers only when the test says so. */
function holdRead() {
  let settle: (response: Response) => void = () => undefined;
  let refuse: (reason: Error) => void = () => undefined;
  const pending = new Promise<Response>((resolve, reject) => {
    settle = resolve;
    refuse = reject;
  });
  fetchMock.mockImplementation(() => pending);
  return {
    settle: (response: Response) => settle(response),
    refuse: (reason: Error) => refuse(reason),
  };
}

describe('useCapabilities', () => {
  it('reads the capability route once, on mount', async () => {
    fetchMock.mockResolvedValue(okResponse(REPORT));

    const { rerender } = renderHook(() => useCapabilities());
    rerender();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      '/api/playback/capabilities'
    );
  });

  it('holds null until the read lands', () => {
    holdRead();

    const { result } = renderHook(() => useCapabilities());

    expect(result.current.capabilities).toBeNull();
  });

  it('hands over the report once it lands', async () => {
    const read = holdRead();
    const { result } = renderHook(() => useCapabilities());

    await act(async () => {
      read.settle(okResponse(REPORT));
    });

    await waitFor(() => expect(result.current.capabilities).toEqual(REPORT));
  });

  it('keeps null when the route refuses', async () => {
    const read = holdRead();
    const { result } = renderHook(() => useCapabilities());

    await act(async () => {
      read.settle(serverErrorResponse());
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.capabilities).toBeNull();
  });

  it('keeps null when the request itself fails', async () => {
    const read = holdRead();
    const { result } = renderHook(() => useCapabilities());

    await act(async () => {
      read.refuse(new Error('offline'));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.capabilities).toBeNull();
  });
});

/** The two halves, as the zone reports them. */
const FFMPEG = new File(['MZ'], 'ffmpeg.exe');
const FFPROBE = new File(['MZ'], 'ffprobe.exe');
const PAIR = [FFMPEG, FFPROBE];

/** The report after the swap: the same machine, with more of it decodable. */
const AFTER: PlaybackCapabilities = {
  component: {
    source: 'uploaded',
    bytes: 101_000_000,
    files: ['ffmpeg.exe', 'ffprobe.exe'],
  },
  codecs: [
    { codec: 'h264', kind: 'video', support: 'native' },
    { codec: 'hevc', kind: 'video', support: 'via-component' },
    { codec: 'ac3', kind: 'audio', support: 'via-component' },
  ],
};

/** The fixed line the hook substitutes when the route named no reason. */
const FALLBACK = "Couldn't add the playback component.";

/** A refusal the route named a reason for, at the status it chose. */
function refusedResponse(status: number, error: string): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
  } as unknown as Response;
}

/** The hook with its first read already landed. */
async function mounted() {
  fetchMock.mockResolvedValue(okResponse(REPORT));
  const view = renderHook(() => useCapabilities());
  await waitFor(() => expect(view.result.current.capabilities).toEqual(REPORT));
  return view;
}

/** A write that answers only when the test says so. */
function holdWrite() {
  let settle: (response: Response) => void = () => undefined;
  const pending = new Promise<Response>((resolve) => {
    settle = resolve;
  });
  fetchMock.mockImplementation(() => pending);
  return { settle: (response: Response) => settle(response) };
}

describe('useCapabilities — installing a component', () => {
  it('starts idle', async () => {
    const { result } = await mounted();

    expect(result.current.upload).toEqual({ kind: 'idle' });
  });

  it('posts the files to the component route', async () => {
    const { result } = await mounted();
    fetchMock.mockResolvedValue(okResponse(AFTER));

    await act(async () => {
      await result.current.installComponent(PAIR);
    });

    expect(String(fetchMock.mock.calls[1][0])).toBe('/api/playback/component');
    expect(fetchMock.mock.calls[1][1]?.method).toBe('POST');
  });

  it('redraws from the echo, without reading again', async () => {
    const { result } = await mounted();
    fetchMock.mockResolvedValue(okResponse(AFTER));

    await act(async () => {
      await result.current.installComponent(PAIR);
    });

    // The read on mount and the write, and nothing else: a second GET would be
    // a second chance to disagree with the swap.
    expect(result.current.capabilities).toEqual(AFTER);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.upload).toEqual({ kind: 'idle' });
  });

  it('is busy installing while the copy and the check run', async () => {
    const { result } = await mounted();
    const write = holdWrite();

    act(() => {
      void result.current.installComponent(PAIR);
    });

    await waitFor(() =>
      expect(result.current.upload).toEqual({ kind: 'busy', action: 'install' })
    );

    await act(async () => {
      write.settle(okResponse(AFTER));
    });
    await waitFor(() =>
      expect(result.current.upload).toEqual({ kind: 'idle' })
    );
  });

  it('ignores a second call while one is in flight', async () => {
    const { result } = await mounted();
    holdWrite();

    act(() => {
      void result.current.installComponent(PAIR);
    });
    await waitFor(() =>
      expect(result.current.upload).toEqual({ kind: 'busy', action: 'install' })
    );
    await act(async () => {
      await result.current.installComponent(PAIR);
    });

    // One read and one write: two uploads cannot race into the same slot.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never rejects out of the hook', async () => {
    const { result } = await mounted();
    fetchMock.mockResolvedValue(refusedResponse(409, 'In use.'));

    await act(async () => {
      await expect(
        result.current.installComponent(PAIR)
      ).resolves.toBeUndefined();
    });
  });
});

describe('useCapabilities — a refused install', () => {
  it('keeps the route’s own words as the reason', async () => {
    const said = "That isn't a working ffmpeg build.";
    const { result } = await mounted();
    fetchMock.mockResolvedValue(refusedResponse(422, said));

    await act(async () => {
      await result.current.installComponent(PAIR);
    });

    expect(result.current.upload).toEqual({ kind: 'refused', reason: said });
  });

  it('leaves the report exactly as it was', async () => {
    const { result } = await mounted();
    fetchMock.mockResolvedValue(
      refusedResponse(400, 'Both halves are needed.')
    );

    await act(async () => {
      await result.current.installComponent(PAIR);
    });

    expect(result.current.capabilities).toEqual(REPORT);
  });

  it('substitutes the fixed line when the route named no reason', async () => {
    const { result } = await mounted();
    fetchMock.mockResolvedValue(serverErrorResponse());

    await act(async () => {
      await result.current.installComponent(PAIR);
    });

    // A `500` is not silence: the zone says something a maintainer can act on.
    expect(result.current.upload).toEqual({
      kind: 'refused',
      reason: FALLBACK,
    });
  });

  it('substitutes it when the request never left either', async () => {
    const { result } = await mounted();
    fetchMock.mockRejectedValue(new Error('offline'));

    await act(async () => {
      await result.current.installComponent(PAIR);
    });

    expect(result.current.upload).toEqual({
      kind: 'refused',
      reason: FALLBACK,
    });
  });

  it('stays refused until the next attempt replaces it', async () => {
    const { result } = await mounted();
    fetchMock.mockResolvedValue(refusedResponse(409, 'In use.'));

    await act(async () => {
      await result.current.installComponent(PAIR);
    });
    expect(result.current.upload).toEqual({
      kind: 'refused',
      reason: 'In use.',
    });

    fetchMock.mockResolvedValue(okResponse(AFTER));
    await act(async () => {
      await result.current.installComponent(PAIR);
    });

    expect(result.current.upload).toEqual({ kind: 'idle' });
    expect(result.current.capabilities).toEqual(AFTER);
  });
});

describe('useCapabilities — the screen left mid-upload', () => {
  it('redraws nothing when the answer lands after the unmount', async () => {
    const { result, unmount } = await mounted();
    const write = holdWrite();

    act(() => {
      void result.current.installComponent(PAIR);
    });
    unmount();

    await act(async () => {
      write.settle(okResponse(AFTER));
    });

    // The report the hook was holding is the last thing it ever held: an
    // upload begun on a screen that has gone has nothing left to tell.
    expect(result.current.capabilities).toEqual(REPORT);
  });
});

/** The report after the fall-back: the default pair, and fewer formats. */
const AFTER_REMOVE: PlaybackCapabilities = {
  component: {
    source: 'default',
    bytes: 98_765_432,
    files: ['ffmpeg.exe', 'ffprobe.exe'],
  },
  codecs: [{ codec: 'h264', kind: 'video', support: 'native' }],
};

/** The fixed line the hook substitutes when a refused remove named no reason. */
const REMOVE_FALLBACK = "Couldn't remove the playback component.";

describe('useCapabilities — removing a component', () => {
  it('asks the component route to take the pair back', async () => {
    const { result } = await mounted();
    fetchMock.mockResolvedValue(okResponse(AFTER_REMOVE));

    await act(async () => {
      await result.current.removeComponent();
    });

    expect(String(fetchMock.mock.calls[1][0])).toBe('/api/playback/component');
    expect(fetchMock.mock.calls[1][1]?.method).toBe('DELETE');
  });

  it('redraws from the echo, without reading again', async () => {
    const { result } = await mounted();
    fetchMock.mockResolvedValue(okResponse(AFTER_REMOVE));

    await act(async () => {
      await result.current.removeComponent();
    });

    expect(result.current.capabilities).toEqual(AFTER_REMOVE);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.upload).toEqual({ kind: 'idle' });
  });

  it('is busy removing while the write is in flight', async () => {
    const { result } = await mounted();
    const write = holdWrite();

    act(() => {
      void result.current.removeComponent();
    });

    await waitFor(() =>
      expect(result.current.upload).toEqual({ kind: 'busy', action: 'remove' })
    );

    await act(async () => {
      write.settle(okResponse(AFTER_REMOVE));
    });
    await waitFor(() =>
      expect(result.current.upload).toEqual({ kind: 'idle' })
    );
  });

  it('ignores a second press while the removal is in flight', async () => {
    const { result } = await mounted();
    holdWrite();

    act(() => {
      void result.current.removeComponent();
    });
    await waitFor(() =>
      expect(result.current.upload).toEqual({ kind: 'busy', action: 'remove' })
    );
    await act(async () => {
      await result.current.removeComponent();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores a press while an install is still running', async () => {
    // One slot, one write at a time: a remove racing an install would be two
    // answers for one component.
    const { result } = await mounted();
    holdWrite();

    act(() => {
      void result.current.installComponent(PAIR);
    });
    await waitFor(() =>
      expect(result.current.upload).toEqual({ kind: 'busy', action: 'install' })
    );
    await act(async () => {
      await result.current.removeComponent();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.upload).toEqual({ kind: 'busy', action: 'install' });
  });

  it('never rejects out of the hook', async () => {
    const { result } = await mounted();
    fetchMock.mockResolvedValue(refusedResponse(409, 'In use.'));

    await act(async () => {
      await expect(result.current.removeComponent()).resolves.toBeUndefined();
    });
  });
});

describe('useCapabilities — a refused remove', () => {
  it('keeps the route’s own words as the reason', async () => {
    const said =
      "The playback component is in use. Stop the film that's playing and try again.";
    const { result } = await mounted();
    fetchMock.mockResolvedValue(refusedResponse(409, said));

    await act(async () => {
      await result.current.removeComponent();
    });

    expect(result.current.upload).toEqual({ kind: 'refused', reason: said });
  });

  it('leaves the report exactly as it was', async () => {
    // Nothing was taken out: the **Component row** still says what it said.
    const { result } = await mounted();
    fetchMock.mockResolvedValue(
      refusedResponse(404, 'The default playback component is not removable.')
    );

    await act(async () => {
      await result.current.removeComponent();
    });

    expect(result.current.capabilities).toEqual(REPORT);
  });

  it('substitutes the remove line when the route named no reason', async () => {
    // Its own line, not the install's: a `500` is not silence, and it is not
    // the wrong sentence either.
    const { result } = await mounted();
    fetchMock.mockResolvedValue(serverErrorResponse());

    await act(async () => {
      await result.current.removeComponent();
    });

    expect(result.current.upload).toEqual({
      kind: 'refused',
      reason: REMOVE_FALLBACK,
    });
  });

  it('substitutes it when the request never left either', async () => {
    const { result } = await mounted();
    fetchMock.mockRejectedValue(new Error('offline'));

    await act(async () => {
      await result.current.removeComponent();
    });

    expect(result.current.upload).toEqual({
      kind: 'refused',
      reason: REMOVE_FALLBACK,
    });
  });
});

describe('useCapabilities — the screen left mid-remove', () => {
  it('redraws nothing when the answer lands after the unmount', async () => {
    const { result, unmount } = await mounted();
    const write = holdWrite();

    act(() => {
      void result.current.removeComponent();
    });
    unmount();

    await act(async () => {
      write.settle(okResponse(AFTER_REMOVE));
    });

    expect(result.current.capabilities).toEqual(REPORT);
  });
});
