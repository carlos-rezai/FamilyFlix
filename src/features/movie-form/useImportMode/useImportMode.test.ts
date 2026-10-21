import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import type { FormKind } from '@/types';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { useImportMode } from './useImportMode';

/**
 * 48 — Add a show folder, refactor (issue #421): the **Import mode**, in a
 * hook of its own on `useEpisodeList`'s pattern.
 *
 * Link on every visit. Each kind answers for its own files: the series by the
 * Show folder read's Library folder (`setShowLink`), the movie by the
 * containing read of the path the **Path bridge** read for its video. While
 * the kind on screen can't link, Copy stands chosen; a later answer enables
 * Link again, and an answer overtaken by a later pick changes nothing. A
 * browser, an edit and a Resolve draw no choice and send Copy.
 *
 * The containing read is a stubbed `fetch`; the bridge is `fakeFolderBridge`.
 */

const HEAT = 'Heat.1995.mp4';
const HEAT_PATH = 'E:\\Films\\Heat (1995)\\Heat.1995.mp4';
const LANTERN = 'Lantern.2020.mp4';
const LANTERN_PATH = 'D:\\Downloads\\Lantern.2020.mp4';

const video = (name: string) => new File(['video bytes'], name);

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

/** The containing read answers `libraryFolderId` for a path. */
const containing = (libraryFolderId: string | null) =>
  okResponse({ libraryFolderId });

const render = (kind: FormKind = 'movie', plainAdd = true) =>
  renderHook(
    (props: { kind: FormKind }) => useImportMode({ ...props, plainAdd }),
    {
      initialProps: { kind },
    }
  );

describe('useImportMode — in the shell', () => {
  const bridge = fakeFolderBridge();

  it('draws the choice with Link chosen on a plain add', () => {
    const { result } = render();

    expect(result.current.showImportMode).toBe(true);
    expect(result.current.importMode).toBe('link');
    expect(result.current.linkDisabled).toBe(false);
  });

  it('chooses Copy, and Link back again', () => {
    const { result } = render();

    act(() => result.current.setImportMode('copy'));
    expect(result.current.importMode).toBe('copy');

    act(() => result.current.setImportMode('link'));
    expect(result.current.importMode).toBe('link');
  });

  it('disables Link and sends Copy for a video under no Library folder', async () => {
    bridge.setPathOf(LANTERN, LANTERN_PATH);
    fetchMock.mockResolvedValue(containing(null));
    const { result } = render();

    act(() => result.current.readVideo(video(LANTERN)));

    await waitFor(() => expect(result.current.linkDisabled).toBe(true));
    expect(result.current.importMode).toBe('copy');
    expect(result.current.videoPath).toBe(LANTERN_PATH);
    act(() => result.current.setImportMode('link'));
    expect(result.current.importMode).toBe('copy');
  });

  it('enables Link again on a later pick under a Library folder', async () => {
    bridge.setPathOf(LANTERN, LANTERN_PATH);
    bridge.setPathOf(HEAT, HEAT_PATH);
    fetchMock.mockResolvedValueOnce(containing(null));
    fetchMock.mockResolvedValueOnce(containing('films'));
    const { result } = render();

    act(() => result.current.readVideo(video(LANTERN)));
    await waitFor(() => expect(result.current.linkDisabled).toBe(true));
    act(() => result.current.readVideo(video(HEAT)));

    await waitFor(() => expect(result.current.linkDisabled).toBe(false));
    expect(result.current.importMode).toBe('link');
  });

  it('ignores a containing answer a later pick overtook', async () => {
    bridge.setPathOf(LANTERN, LANTERN_PATH);
    bridge.setPathOf(HEAT, HEAT_PATH);
    let answerLantern: (response: Response) => void = () => undefined;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        answerLantern = resolve;
      })
    );
    fetchMock.mockResolvedValueOnce(containing('films'));
    const { result } = render();

    act(() => result.current.readVideo(video(LANTERN)));
    act(() => result.current.readVideo(video(HEAT)));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await act(async () => answerLantern(containing(null)));

    expect(result.current.linkDisabled).toBe(false);
    expect(result.current.videoPath).toBe(HEAT_PATH);
  });

  it('disables Link without asking when the Path bridge reads no path', () => {
    const { result } = render();

    act(() => result.current.readVideo(video(HEAT)));

    expect(result.current.linkDisabled).toBe(true);
    expect(result.current.videoPath).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forgets the video’s path and its answer when the slot is emptied', () => {
    const { result } = render();
    act(() => result.current.readVideo(video(HEAT)));

    act(() => result.current.forgetVideo());

    expect(result.current.linkDisabled).toBe(false);
    expect(result.current.videoPath).toBe('');
  });

  it('holds the movie’s and the show’s answers apart', () => {
    const { result, rerender } = render('series');

    act(() => result.current.setShowLink(false));
    expect(result.current.linkDisabled).toBe(true);
    expect(result.current.importMode).toBe('copy');

    rerender({ kind: 'movie' });
    expect(result.current.linkDisabled).toBe(false);

    rerender({ kind: 'series' });
    act(() => result.current.setShowLink(true));
    expect(result.current.linkDisabled).toBe(false);
  });

  it('draws no choice on an edit or a Resolve, and sends Copy', () => {
    const { result } = render('movie', false);

    act(() => result.current.readVideo(video(HEAT)));

    expect(result.current.showImportMode).toBe(false);
    expect(result.current.importMode).toBe('copy');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('useImportMode — in a browser', () => {
  it('draws no choice and sends Copy', () => {
    const { result } = render();

    act(() => result.current.readVideo(video(HEAT)));

    expect(result.current.showImportMode).toBe(false);
    expect(result.current.importMode).toBe('copy');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
