import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import type { ShowFolderRead } from '@/types';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { useEpisodeList } from '../useEpisodeList/useEpisodeList';
import { useShowFolderPick } from './useShowFolderPick';

/** The two fields of a read the form is prefilled from. */
type FolderKey = Pick<ShowFolderRead, 'title' | 'year'>;

/**
 * 48 — Add a show folder, refactor (issue #421): the series add's **Show
 * folder pick**, in a hook of its own on `useEpisodeList`'s pattern.
 *
 * The folder the one-folder dialog answered is read by the server; its rows
 * land after the ones added by hand, the form is offered its **Folder key**
 * (issue #629: `prefillFolderKey`, with the key the last pick offered), and
 * its Library folder says whether Link can be. A cancel changes
 * nothing; a refusal — unreadable, empty, or a held series's own folder,
 * worded by that series's title — adds no rows. A second pick replaces only
 * the first pick's rows, and the ✕ takes off only the folder's.
 *
 * Over the real `useEpisodeList`, so the rows are the list's; the wire is a
 * stubbed `fetch`, the bridge `fakeFolderBridge`.
 */

const HARBOR = 'E:\\Shows\\Harbor and Vine';
const LIGHTHOUSE = 'E:\\Shows\\Lighthouse Keepers';
const SEVERANCE = 'E:\\Shows\\Severance (2022–)';

/** A read of `path` holding one episode per video named. */
const readOf = (
  path: string,
  videos: string[],
  extra: Partial<ShowFolderRead> = {}
): ShowFolderRead => ({
  path,
  title: path.slice(path.lastIndexOf('\\') + 1),
  year: null,
  libraryFolderId: 'shows',
  heldSeriesId: null,
  poster: null,
  backdrop: null,
  seasonPosters: [],
  episodes: videos.map((video, index) => ({
    season: 1,
    number: index + 1,
    title: null,
    video: `${path}\\${video}`,
    relativePath: video,
    still: null,
    subtitles: [],
  })),
  unplaced: [],
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
  const prefillFolderKey =
    vi.fn<(key: FolderKey, picked: FolderKey | null) => void>();
  const setShowLink = vi.fn<(available: boolean) => void>();
  const rendered = renderHook(() => {
    const list = useEpisodeList();
    const pick = useShowFolderPick({
      plainAdd: true,
      holdShowFolder: list.holdShowFolder,
      removeShowFolder: list.removeShowFolder,
      prefillFolderKey,
      prefillFolderArt: () => undefined,
      setShowLink,
    });
    return { list, pick };
  });
  return { ...rendered, prefillFolderKey, setShowLink };
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
    const { result, prefillFolderKey, setShowLink } = renderPick();

    await act(async () => result.current.pick.addShowFolder?.());

    await waitFor(() => expect(result.current.pick.showFolder).toBe(HARBOR));
    expect(filenames(result)).toEqual(['S01E01.mkv']);
    expect(result.current.pick.straySubtitles).toBe(2);
    expect(result.current.pick.refusal).toBeNull();
    expect(prefillFolderKey).toHaveBeenCalledWith(
      { title: 'Harbor and Vine', year: null },
      null
    );
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
    const { result, prefillFolderKey } = renderPick();

    await act(async () => result.current.pick.addShowFolder?.());

    await waitFor(() => expect(result.current.pick.refusal).toBe(sentence));
    expect(result.current.pick.showFolder).toBeNull();
    expect(result.current.list.episodes).toEqual([]);
    expect(prefillFolderKey).not.toHaveBeenCalled();
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

describe('useShowFolderPick: the Folder key (issue #629)', () => {
  const bridge = fakeFolderBridge();

  it('offers the read’s key, and `null` for the picked one, on a first pick', async () => {
    bridge.setPickOne(SEVERANCE);
    fetchMock.mockResolvedValue(
      okResponse(
        readOf(SEVERANCE, ['S01E01.mkv'], { title: 'Severance', year: 2022 })
      )
    );
    const { result, prefillFolderKey } = renderPick();

    await act(async () => result.current.pick.addShowFolder?.());

    await waitFor(() => expect(result.current.pick.showFolder).toBe(SEVERANCE));
    expect(prefillFolderKey).toHaveBeenCalledTimes(1);
    expect(prefillFolderKey).toHaveBeenCalledWith(
      { title: 'Severance', year: 2022 },
      null
    );
  });

  it('offers the first pick’s key as the picked one on a second pick', async () => {
    const { result, prefillFolderKey } = renderPick();
    bridge.setPickOne(SEVERANCE);
    fetchMock.mockResolvedValueOnce(
      okResponse(
        readOf(SEVERANCE, ['S01E01.mkv'], { title: 'Severance', year: 2022 })
      )
    );
    await act(async () => result.current.pick.addShowFolder?.());
    await waitFor(() => expect(result.current.pick.showFolder).toBe(SEVERANCE));

    bridge.setPickOne(LIGHTHOUSE);
    fetchMock.mockResolvedValueOnce(okResponse(readOf(LIGHTHOUSE, ['L1.mkv'])));
    await act(async () => result.current.pick.addShowFolder?.());

    await waitFor(() =>
      expect(result.current.pick.showFolder).toBe(LIGHTHOUSE)
    );
    expect(prefillFolderKey).toHaveBeenLastCalledWith(
      { title: 'Lighthouse Keepers', year: null },
      { title: 'Severance', year: 2022 }
    );
  });

  it('names a held pick by the read’s title when the held series can’t be read, and offers no key', async () => {
    bridge.setPickOne(SEVERANCE);
    fetchMock.mockImplementation((input) =>
      String(input).startsWith('/api/show-folder')
        ? Promise.resolve(
            okResponse(
              readOf(SEVERANCE, ['S01E01.mkv'], {
                title: 'Severance',
                year: 2022,
                heldSeriesId: 'severance',
              })
            )
          )
        : Promise.reject(new TypeError('Failed to fetch'))
    );
    const { result, prefillFolderKey } = renderPick();

    await act(async () => result.current.pick.addShowFolder?.());

    await waitFor(() =>
      expect(result.current.pick.refusal).toBe(
        'Severance is already in your library.'
      )
    );
    expect(result.current.list.episodes).toEqual([]);
    expect(prefillFolderKey).not.toHaveBeenCalled();
  });
});

describe('useShowFolderPick — in a browser', () => {
  it('offers no pick in a browser', () => {
    const { result } = renderPick();

    expect(result.current.pick.addShowFolder).toBeNull();
  });
});
