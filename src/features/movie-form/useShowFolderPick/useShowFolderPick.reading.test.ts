import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import type { ShowFolderRead } from '@/types';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';
import { useEpisodeList } from '../useEpisodeList/useEpisodeList';
import { useShowFolderPick } from './useShowFolderPick';

/**
 * 69, Silent waits, Phase 5 (issue #660): the **Show folder pick**'s read on
 * the **Loader timing**.
 *
 * `reading` is a **Busy phase** wrapping the folder read and the held
 * series' title read, never the dialog: `idle` while the one-folder dialog
 * is open, `waiting` from its answer, `shown` once the read has run 300ms,
 * held 500ms once shown. A refused read settles back to `idle` with its
 * refusal sentence.
 *
 * The wire is `heldFetch`, the dialog `fakeFolderBridge` held open by hand.
 */

const HARBOR = 'E:\\Shows\\Harbor and Vine';
const UNREADABLE = 'That folder can’t be read.';

/** A read of the show holding one episode. */
const readOf = (extra: Partial<ShowFolderRead> = {}): ShowFolderRead => ({
  path: HARBOR,
  title: 'Harbor and Vine',
  year: null,
  libraryFolderId: 'shows',
  heldSeriesId: null,
  poster: null,
  backdrop: null,
  episodes: [
    {
      season: 1,
      number: 1,
      title: null,
      video: `${HARBOR}\\S01E01.mkv`,
      relativePath: 'S01E01.mkv',
      subtitles: [],
    },
  ],
  unplaced: [],
  straySubtitles: 0,
  ...extra,
});

/** The `400` the read answers for a refused folder. */
const refusedResponse = (error: string): Response =>
  ({
    ok: false,
    status: 400,
    json: () => Promise.resolve({ error }),
  }) as unknown as Response;

const { respond, fetchMock } = heldFetch();

afterEach(() => {
  vi.useRealTimers();
});

function renderPick() {
  return renderHook(() => {
    const list = useEpisodeList();
    return useShowFolderPick({
      plainAdd: true,
      holdShowFolder: list.holdShowFolder,
      removeShowFolder: list.removeShowFolder,
      prefillFolderKey: () => undefined,
      prefillFolderArt: () => undefined,
      setShowLink: () => undefined,
    });
  });
}

describe('useShowFolderPick: reading on the Loader timing', () => {
  const bridge = fakeFolderBridge();

  /** Press _＋ Add show folder_ on a faked clock, the dialog answering HARBOR. */
  async function pressAndPick(result: {
    current: { addShowFolder: (() => void) | null };
  }) {
    bridge.setPickOne(HARBOR);
    vi.useFakeTimers();
    await act(async () => result.current.addShowFolder?.());
  }

  it('is idle before a press', () => {
    const { result } = renderPick();

    expect(result.current.reading).toBe('idle');
  });

  it('stays idle while the dialog is open', async () => {
    let answerDialog: (path: string | null) => void = () => undefined;
    vi.spyOn(bridge.folders, 'pickOne').mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          answerDialog = resolve;
        })
    );
    const { result } = renderPick();
    vi.useFakeTimers();

    await act(async () => result.current.addShowFolder?.());
    await advanceClock(1000);

    expect(result.current.reading).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => answerDialog(HARBOR));

    expect(result.current.reading).toBe('waiting');
  });

  it('stays idle on a cancelled dialog', async () => {
    const { result } = renderPick();
    vi.useFakeTimers();

    await act(async () => result.current.addShowFolder?.());
    await advanceClock(1000);

    expect(result.current.reading).toBe('idle');
  });

  it('moves through waiting and shown across a held read, held 500ms once shown', async () => {
    const { result } = renderPick();
    await pressAndPick(result);

    expect(result.current.reading).toBe('waiting');

    await advanceClock(299);
    expect(result.current.reading).toBe('waiting');

    await advanceClock(1);
    expect(result.current.reading).toBe('shown');

    await advanceClock(100);
    await respond(okResponse(readOf()));

    await advanceClock(399);
    expect(result.current.reading).toBe('shown');

    await advanceClock(1);
    expect(result.current.reading).toBe('idle');
    expect(result.current.showFolder).toBe(HARBOR);
  });

  it('stays shown across the held series’ title read', async () => {
    const { result } = renderPick();
    await pressAndPick(result);
    await advanceClock(300);

    await respond(okResponse(readOf({ heldSeriesId: 'harbor' })));
    await advanceClock(2000);

    expect(result.current.reading).toBe('shown');
    expect(result.current.refusal).toBeNull();

    await respond(
      okResponse(makeSeriesDetail([], { id: 'harbor', title: 'Harbor & Vine' }))
    );
    await advanceClock(0);

    expect(result.current.reading).toBe('idle');
    expect(result.current.refusal).toBe(
      'Harbor & Vine is already in your library.'
    );
  });

  it('returns to idle with its refusal sentence on a refused read', async () => {
    const { result } = renderPick();
    await pressAndPick(result);
    await advanceClock(400);

    await respond(refusedResponse(UNREADABLE));
    await advanceClock(400);

    expect(result.current.reading).toBe('idle');
    expect(result.current.refusal).toBe(UNREADABLE);
    expect(result.current.showFolder).toBeNull();
  });
});
