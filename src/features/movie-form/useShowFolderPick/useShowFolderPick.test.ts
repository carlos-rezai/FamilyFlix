import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import type { ShowFolderRead } from '@/types';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { useEpisodeList } from '../useEpisodeList/useEpisodeList';
import { useShowFolderPick } from './useShowFolderPick';

/**
 * 48 — Add a show folder, refactor (issue #421): the series add's **Show
 * folder pick**, in a hook of its own on `useEpisodeList`'s pattern.
 *
 * The folder the one-folder dialog answered is read by the server; its rows
 * land after the ones added by hand, the empty title takes its **Title
 * guess**, and its Library folder says whether Link can be. A cancel changes
 * nothing; a refusal — unreadable, empty, or a held series's own folder,
 * worded by that series's title — adds no rows. A second pick replaces only
 * the first pick's rows, and the ✕ takes off only the folder's.
 *
 * Over the real `useEpisodeList`, so the rows are the list's; the wire is a
 * stubbed `fetch`, the bridge `fakeFolderBridge`.
 */

const HARBOR = 'E:\\Shows\\Harbor and Vine';
const LIGHTHOUSE = 'E:\\Shows\\Lighthouse Keepers';

/** A read of `path` holding one episode per video named. */
const readOf = (
  path: string,
  videos: string[],
  extra: Partial<ShowFolderRead> = {}
): ShowFolderRead => ({
  path,
  titleGuess: path.slice(path.lastIndexOf('\\') + 1),
  libraryFolderId: 'shows',
  heldSeriesId: null,
  episodes: videos.map((video, index) => ({
    season: 1,
    number: index + 1,
    title: null,
    video: `${path}\\${video}`,
    relativePath: video,
    subtitles: [],
  })),
  unplaced: [],
  unplacedRelative: [],
  straySubtitles: 0,
  ...extra,
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

/** The `400` the read answers for a refused folder. */
const refused = (error: string) =>
  new Response(JSON.stringify({ error }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });

/** The pick over a real episode list, with the title and Link it would set. */
function renderPick() {
  const prefillTitle = vi.fn<(guess: string) => void>();
  const setShowLink = vi.fn<(available: boolean) => void>();
  const rendered = renderHook(() => {
    const list = useEpisodeList();
    const pick = useShowFolderPick({
      plainAdd: true,
      holdShowFolder: list.holdShowFolder,
      removeShowFolder: list.removeShowFolder,
      prefillTitle,
      setShowLink,
    });
    return { list, pick };
  });
  return { ...rendered, prefillTitle, setShowLink };
}

/** The rows' filenames, in order. */
const filenames = (result: {
  current: { list: ReturnType<typeof useEpisodeList> };
}) => result.current.list.episodes.map((row) => row.file?.filename);

describe('useShowFolderPick', () => {
  const bridge = fakeFolderBridge();

  it('changes nothing on a cancelled dialog', async () => {
    const { result } = renderPick();

    await act(async () => result.current.pick.addShowFolder?.());

    expect(bridge.pickOnes()).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.pick.showFolder).toBeNull();
    expect(result.current.list.episodes).toEqual([]);
  });

  it('fills the rows, the title and Link from a read', async () => {
    bridge.setPickOne(HARBOR);
    fetchMock.mockResolvedValue(
      okResponse(readOf(HARBOR, ['S01E01.mkv'], { straySubtitles: 2 }))
    );
    const { result, prefillTitle, setShowLink } = renderPick();

    await act(async () => result.current.pick.addShowFolder?.());

    await waitFor(() => expect(result.current.pick.showFolder).toBe(HARBOR));
    expect(filenames(result)).toEqual(['S01E01.mkv']);
    expect(result.current.pick.straySubtitles).toBe(2);
    expect(result.current.pick.refusal).toBeNull();
    expect(prefillTitle).toHaveBeenCalledWith('Harbor and Vine');
    expect(setShowLink).toHaveBeenCalledWith(true);
  });

  it('says Link can’t be for a folder under no Library folder', async () => {
    bridge.setPickOne(HARBOR);
    fetchMock.mockResolvedValue(
      okResponse(readOf(HARBOR, ['S01E01.mkv'], { libraryFolderId: null }))
    );
    const { result, setShowLink } = renderPick();

    await act(async () => result.current.pick.addShowFolder?.());

    await waitFor(() => expect(setShowLink).toHaveBeenCalledWith(false));
  });

  it.each([
    ['That folder can’t be read.'],
    ['There are no videos in that folder.'],
  ])('draws the refusal “%s” and adds nothing', async (sentence) => {
    bridge.setPickOne(HARBOR);
    fetchMock.mockResolvedValue(refused(sentence));
    const { result, prefillTitle } = renderPick();

    await act(async () => result.current.pick.addShowFolder?.());

    await waitFor(() => expect(result.current.pick.refusal).toBe(sentence));
    expect(result.current.pick.showFolder).toBeNull();
    expect(result.current.list.episodes).toEqual([]);
    expect(prefillTitle).not.toHaveBeenCalled();
  });

  it('refuses a held series’s own folder by that series’s title', async () => {
    bridge.setPickOne(HARBOR);
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        String(input).startsWith('/api/show-folder')
          ? okResponse(
              readOf(HARBOR, ['S01E01.mkv'], { heldSeriesId: 'harbor' })
            )
          : okResponse(
              makeSeriesDetail([], { id: 'harbor', title: 'Harbor & Vine' })
            )
      )
    );
    const { result } = renderPick();

    await act(async () => result.current.pick.addShowFolder?.());

    await waitFor(() =>
      expect(result.current.pick.refusal).toBe(
        'Harbor & Vine is already in your library.'
      )
    );
    expect(result.current.list.episodes).toEqual([]);
  });

  it('replaces only the first pick’s rows on a second pick', async () => {
    const { result } = renderPick();
    act(() =>
      result.current.list.addEpisodeFiles([new File(['v'], 'by-hand.mkv')])
    );
    bridge.setPickOne(HARBOR);
    fetchMock.mockResolvedValueOnce(okResponse(readOf(HARBOR, ['H1.mkv'])));
    await act(async () => result.current.pick.addShowFolder?.());
    await waitFor(() => expect(filenames(result)).toHaveLength(2));

    bridge.setPickOne(LIGHTHOUSE);
    fetchMock.mockResolvedValueOnce(
      okResponse(readOf(LIGHTHOUSE, ['L1.mkv', 'L2.mkv']))
    );
    await act(async () => result.current.pick.addShowFolder?.());

    await waitFor(() =>
      expect(result.current.pick.showFolder).toBe(LIGHTHOUSE)
    );
    expect(filenames(result)).toEqual(['by-hand.mkv', 'L1.mkv', 'L2.mkv']);
  });

  it('takes off only the folder’s rows with its ✕, and Link can be again', async () => {
    const { result, setShowLink } = renderPick();
    act(() =>
      result.current.list.addEpisodeFiles([new File(['v'], 'by-hand.mkv')])
    );
    bridge.setPickOne(HARBOR);
    fetchMock.mockResolvedValue(
      okResponse(readOf(HARBOR, ['H1.mkv'], { straySubtitles: 1 }))
    );
    await act(async () => result.current.pick.addShowFolder?.());
    await waitFor(() => expect(result.current.pick.showFolder).toBe(HARBOR));

    act(() => result.current.pick.removeShowFolder());

    expect(result.current.pick.showFolder).toBeNull();
    expect(result.current.pick.straySubtitles).toBe(0);
    expect(filenames(result)).toEqual(['by-hand.mkv']);
    expect(setShowLink).toHaveBeenLastCalledWith(true);
  });
});

describe('useShowFolderPick — in a browser', () => {
  it('offers no pick in a browser', () => {
    const { result } = renderPick();

    expect(result.current.pick.addShowFolder).toBeNull();
  });
});
