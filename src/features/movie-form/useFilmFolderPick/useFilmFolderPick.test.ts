import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import type { FilmFolderRead } from '@/types';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { useFilmFolderPick } from './useFilmFolderPick';

/**
 * 76, Whole add (log 76 Q23): the movie add's **Film folder read**, through
 * the hook's own face.
 *
 * In the shell, on a plain add, a picked video's path is read through the
 * **Path bridge** and its folder asked for its art and tracks; the form is
 * offered the read with the one an earlier pick offered (`null` before any),
 * the ✕ offers the empty read against the last one, and an answer that lands
 * after the ✕ or a later pick offers nothing. No bridge, an edit, a file with
 * no path or a refused read offers nothing.
 *
 * The wire is a stubbed `fetch`, the bridge `fakeFolderBridge`.
 */

const HEAT = 'E:\\Films\\Heat (1995)';
const RONIN = 'E:\\Films\\Ronin (1998)';

const HEAT_FILE = new File(['frames'], 'Heat.mkv', {
  type: 'video/x-matroska',
});
const RONIN_FILE = new File(['frames'], 'Ronin.mkv', {
  type: 'video/x-matroska',
});

const HEAT_READ: FilmFolderRead = {
  poster: `${HEAT}\\Images\\poster.jpg`,
  backdrop: `${HEAT}\\Images\\backdrop.jpg`,
  subtitles: [{ path: `${HEAT}\\Heat.en.srt`, language: 'English' }],
};
const RONIN_READ: FilmFolderRead = {
  poster: `${RONIN}\\Images\\poster.jpg`,
  backdrop: null,
  subtitles: [],
};
const NO_FILM: FilmFolderRead = { poster: null, backdrop: null, subtitles: [] };

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

/** A response the test answers later, with `answer`. */
function heldResponse() {
  let answer: (response: Response) => void = () => undefined;
  const response = new Promise<Response>((resolve) => {
    answer = resolve;
  });
  return { response, answer };
}

/** The hook on a plain add, or on an edit, with the reads it would offer. */
function renderPick(plainAdd = true) {
  const prefillFilmFolder =
    vi.fn<(read: FilmFolderRead, picked: FilmFolderRead | null) => void>();
  const rendered = renderHook(() =>
    useFilmFolderPick({ plainAdd, prefillFilmFolder })
  );
  return { ...rendered, prefillFilmFolder };
}

/** Let every answer already given land. */
const settle = () => act(async () => undefined);

describe('useFilmFolderPick: in the shell', () => {
  const bridge = fakeFolderBridge();

  beforeEach(() => {
    bridge.setPathOf('Heat.mkv', `${HEAT}\\Heat.mkv`);
    bridge.setPathOf('Ronin.mkv', `${RONIN}\\Ronin.mkv`);
  });

  it('reads the picked video’s folder and offers the read, with `null` for the picked one', async () => {
    fetchMock.mockResolvedValue(okResponse(HEAT_READ));
    const { result, prefillFilmFolder } = renderPick();

    act(() => result.current.readFilm(HEAT_FILE));
    await settle();

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/film-folder?video=${encodeURIComponent(`${HEAT}\\Heat.mkv`)}`
    );
    expect(prefillFilmFolder).toHaveBeenCalledTimes(1);
    expect(prefillFilmFolder).toHaveBeenCalledWith(HEAT_READ, null);
  });

  it('offers the earlier read as the picked one on a second pick', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse(HEAT_READ))
      .mockResolvedValueOnce(okResponse(RONIN_READ));
    const { result, prefillFilmFolder } = renderPick();

    act(() => result.current.readFilm(HEAT_FILE));
    await settle();
    act(() => result.current.readFilm(RONIN_FILE));
    await settle();

    expect(prefillFilmFolder).toHaveBeenCalledTimes(2);
    expect(prefillFilmFolder).toHaveBeenLastCalledWith(RONIN_READ, HEAT_READ);
  });

  it('offers the empty read against the last one on the ✕, and only once', async () => {
    fetchMock.mockResolvedValue(okResponse(HEAT_READ));
    const { result, prefillFilmFolder } = renderPick();
    act(() => result.current.readFilm(HEAT_FILE));
    await settle();

    act(() => result.current.forgetFilm());
    act(() => result.current.forgetFilm());

    expect(prefillFilmFolder).toHaveBeenCalledTimes(2);
    expect(prefillFilmFolder).toHaveBeenLastCalledWith(NO_FILM, HEAT_READ);
  });

  it('offers nothing on a ✕ before any read landed', async () => {
    const { result, prefillFilmFolder } = renderPick();

    act(() => result.current.forgetFilm());
    await settle();

    expect(prefillFilmFolder).not.toHaveBeenCalled();
  });

  it('drops an answer that lands after the ✕', async () => {
    const held = heldResponse();
    fetchMock.mockReturnValueOnce(held.response);
    const { result, prefillFilmFolder } = renderPick();

    act(() => result.current.readFilm(HEAT_FILE));
    act(() => result.current.forgetFilm());
    held.answer(okResponse(HEAT_READ));
    await settle();

    expect(prefillFilmFolder).not.toHaveBeenCalled();
  });

  it('drops an answer that lands after a later pick', async () => {
    const held = heldResponse();
    fetchMock
      .mockReturnValueOnce(held.response)
      .mockResolvedValueOnce(okResponse(RONIN_READ));
    const { result, prefillFilmFolder } = renderPick();

    act(() => result.current.readFilm(HEAT_FILE));
    act(() => result.current.readFilm(RONIN_FILE));
    await settle();
    held.answer(okResponse(HEAT_READ));
    await settle();

    expect(prefillFilmFolder).toHaveBeenCalledTimes(1);
    expect(prefillFilmFolder).toHaveBeenCalledWith(RONIN_READ, null);
  });

  it('reads nothing on an edit', async () => {
    const { result, prefillFilmFolder } = renderPick(false);

    act(() => result.current.readFilm(HEAT_FILE));
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prefillFilmFolder).not.toHaveBeenCalled();
  });

  it('reads nothing for a file with no path', async () => {
    const { result, prefillFilmFolder } = renderPick();

    act(() => result.current.readFilm(new File(['frames'], 'Dropped.mkv', {})));
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prefillFilmFolder).not.toHaveBeenCalled();
  });

  it('offers nothing when the read is refused', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());
    const { result, prefillFilmFolder } = renderPick();

    act(() => result.current.readFilm(HEAT_FILE));
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prefillFilmFolder).not.toHaveBeenCalled();
  });
});

describe('useFilmFolderPick: in a browser', () => {
  it('reads nothing with no bridge', async () => {
    const { result, prefillFilmFolder } = renderPick();

    act(() => result.current.readFilm(HEAT_FILE));
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prefillFilmFolder).not.toHaveBeenCalled();
  });
});
