import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import type { FolderArt, ShowFolderRead } from '@/types';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { useEpisodeList } from '../useEpisodeList/useEpisodeList';
import { useShowFolderPick } from './useShowFolderPick';

/**
 * 76, Whole add, Phase 3 (issue #718): the pick offers the Season posters
 * and fills the Stills.
 *
 * The **Folder art** `useShowFolderPick` offers carries the read's **Season
 * posters** as `seasonPosters`, by season; the Show folder row's ✕ offers
 * empty art with the pick's, so each slot still holding it empties. Each row
 * the pick holds carries its **Still** as a **Found file**.
 *
 * Over the real `useEpisodeList`; the wire is a stubbed `fetch`, the bridge
 * `fakeFolderBridge`.
 */

const SHOW = 'E:\\Shows\\The Show (2019)';
const S1_POSTER = `${SHOW}\\Season 01\\Images\\poster.jpg`;
const S3_POSTER = `${SHOW}\\Season 03\\Images\\poster.jpg`;
const PILOT_STILL = `${SHOW}\\Season 01\\Images\\Stills\\S01E01.jpg`;

const READ: ShowFolderRead = {
  path: SHOW,
  title: 'The Show',
  year: 2019,
  libraryFolderId: 'shows',
  heldSeriesId: null,
  poster: null,
  backdrop: null,
  seasonPosters: [
    { season: 1, path: S1_POSTER },
    { season: 3, path: S3_POSTER },
  ],
  episodes: [
    {
      season: 1,
      number: 1,
      title: null,
      video: `${SHOW}\\Season 01\\S01E01.mkv`,
      relativePath: 'Season 01/S01E01.mkv',
      subtitles: [],
      still: PILOT_STILL,
    },
    {
      season: 3,
      number: 1,
      title: null,
      video: `${SHOW}\\Season 03\\S03E01.mkv`,
      relativePath: 'Season 03/S03E01.mkv',
      subtitles: [],
      still: null,
    },
  ],
  unplaced: [],
  straySubtitles: 0,
};

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

describe('useShowFolderPick: Season posters and Stills', () => {
  const bridge = fakeFolderBridge();

  async function pickTheShow() {
    bridge.setPickOne(SHOW);
    fetchMock.mockResolvedValue(okResponse(READ));
    const rendered = renderPick();
    await act(async () => rendered.result.current.pick.addShowFolder?.());
    await waitFor(() =>
      expect(rendered.result.current.pick.showFolder).toBe(SHOW)
    );
    return rendered;
  }

  it('offers the read’s Season posters by season', async () => {
    const { prefillFolderArt } = await pickTheShow();

    expect(prefillFolderArt).toHaveBeenCalledWith(
      {
        poster: null,
        backdrop: null,
        seasonPosters: { 1: S1_POSTER, 3: S3_POSTER },
      },
      null
    );
  });

  it('holds each row’s Still as a Found file', async () => {
    const { result } = await pickTheShow();

    expect(result.current.list.episodes.map((row) => row.still)).toEqual([
      { kind: 'found', path: PILOT_STILL, filename: 'S01E01.jpg' },
      null,
    ]);
  });

  it('offers empty art with the pick’s Season posters on the ✕', async () => {
    const { result, prefillFolderArt } = await pickTheShow();

    act(() => result.current.pick.removeShowFolder());

    expect(prefillFolderArt).toHaveBeenLastCalledWith(
      { poster: null, backdrop: null, seasonPosters: {} },
      {
        poster: null,
        backdrop: null,
        seasonPosters: { 1: S1_POSTER, 3: S3_POSTER },
      }
    );
  });
});
