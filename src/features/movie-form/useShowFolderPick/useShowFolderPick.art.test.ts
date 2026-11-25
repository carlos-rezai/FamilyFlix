import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import type { FolderArt, ShowFolderRead } from '@/types';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { useEpisodeList } from '../useEpisodeList/useEpisodeList';
import { useShowFolderPick } from './useShowFolderPick';

/**
 * 76, Whole add, Phase 2 (issue #717): the pick offers the show's art.
 *
 * Beside `prefillFolderKey`, `useShowFolderPick` takes
 * `prefillFolderArt(art, picked)`: the read's **Poster** and **Backdrop** as
 * a **FolderArt** (absolute paths, `null` for none), with the art the last
 * pick offered (`null` before any), so the form can apply its one fill rule.
 * A folder with no art is offered as `null`s, which fills nothing.
 *
 * Over the real `useEpisodeList`; the wire is a stubbed `fetch`, the bridge
 * `fakeFolderBridge`.
 */

const HARBOR = 'E:\\Shows\\Harbor and Vine';
const LIGHTHOUSE = 'E:\\Shows\\Lighthouse Keepers';

/** A read of `path` holding one episode, with the art given. */
const readOf = (
  path: string,
  poster: string | null,
  backdrop: string | null
): ShowFolderRead => ({
  path,
  title: path.slice(path.lastIndexOf('\\') + 1),
  year: null,
  libraryFolderId: 'shows',
  heldSeriesId: null,
  poster,
  backdrop,
  episodes: [
    {
      season: 1,
      number: 1,
      title: null,
      video: `${path}\\S01E01.mkv`,
      relativePath: 'S01E01.mkv',
      subtitles: [],
    },
  ],
  unplaced: [],
  straySubtitles: 0,
});

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

/** The pick over a real episode list, with the art it would offer. */
function renderPick() {
  const prefillFolderArt =
    vi.fn<(art: FolderArt, picked: FolderArt | null) => void>();
  const rendered = renderHook(() => {
    const list = useEpisodeList();
    const pick = useShowFolderPick({
      plainAdd: true,
      holdShowFolder: list.holdShowFolder,
      removeShowFolder: list.removeShowFolder,
      prefillFolderKey: () => undefined,
      prefillFolderArt,
      setShowLink: () => undefined,
    });
    return { list, pick };
  });
  return { ...rendered, prefillFolderArt };
}

describe('useShowFolderPick: the show’s art', () => {
  const bridge = fakeFolderBridge();

  it('offers the read’s poster and backdrop, and `null` for the picked art, on a first pick', async () => {
    bridge.setPickOne(HARBOR);
    fetchMock.mockResolvedValue(
      okResponse(
        readOf(
          HARBOR,
          `${HARBOR}\\Images\\poster.jpg`,
          `${HARBOR}\\Images\\backdrop.jpg`
        )
      )
    );
    const { result, prefillFolderArt } = renderPick();

    await act(async () => result.current.pick.addShowFolder?.());

    await waitFor(() => expect(result.current.pick.showFolder).toBe(HARBOR));
    expect(prefillFolderArt).toHaveBeenCalledTimes(1);
    expect(prefillFolderArt).toHaveBeenCalledWith(
      expect.objectContaining({
        poster: `${HARBOR}\\Images\\poster.jpg`,
        backdrop: `${HARBOR}\\Images\\backdrop.jpg`,
      }),
      null
    );
  });

  it('offers the first pick’s art as the picked art on a second pick', async () => {
    const { result, prefillFolderArt } = renderPick();
    bridge.setPickOne(HARBOR);
    fetchMock.mockResolvedValueOnce(
      okResponse(readOf(HARBOR, `${HARBOR}\\Images\\poster.jpg`, null))
    );
    await act(async () => result.current.pick.addShowFolder?.());
    await waitFor(() => expect(result.current.pick.showFolder).toBe(HARBOR));

    bridge.setPickOne(LIGHTHOUSE);
    fetchMock.mockResolvedValueOnce(
      okResponse(
        readOf(LIGHTHOUSE, null, `${LIGHTHOUSE}\\Images\\backdrop.jpg`)
      )
    );
    await act(async () => result.current.pick.addShowFolder?.());

    await waitFor(() =>
      expect(result.current.pick.showFolder).toBe(LIGHTHOUSE)
    );
    expect(prefillFolderArt).toHaveBeenLastCalledWith(
      expect.objectContaining({
        poster: null,
        backdrop: `${LIGHTHOUSE}\\Images\\backdrop.jpg`,
      }),
      expect.objectContaining({
        poster: `${HARBOR}\\Images\\poster.jpg`,
        backdrop: null,
      })
    );
  });

  it('offers a folder with no art as nulls', async () => {
    bridge.setPickOne(HARBOR);
    fetchMock.mockResolvedValue(okResponse(readOf(HARBOR, null, null)));
    const { result, prefillFolderArt } = renderPick();

    await act(async () => result.current.pick.addShowFolder?.());

    await waitFor(() => expect(result.current.pick.showFolder).toBe(HARBOR));
    expect(prefillFolderArt).toHaveBeenCalledWith(
      expect.objectContaining({ poster: null, backdrop: null }),
      null
    );
    expect(result.current.pick.reading).toBe('idle');
  });
});
