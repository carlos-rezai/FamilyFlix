import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useExport } from './useExport';
import type { ExportSummary } from '@/types';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';

/**
 * 31 — Export options, Phase 5: "_Browse…_" (issue #280).
 *
 * `useExport`'s `browse` is the native one-folder dialog behind _Save to_:
 * `null` in a browser, where `folderBridge()` is `null`, and in the desktop
 * app a call that opens `pickOne()`. A pick writes the field; a cancel leaves
 * it as it was.
 *
 * The wire is a stubbed `fetch` answering the summary; the dialog is
 * `fakeFolderBridge`.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(() => Promise.resolve(okResponse(SUMMARY)));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const SUMMARY: ExportSummary = {
  movieCount: 3,
  seriesCount: 1,
  episodeCount: 8,
  defaultDestination: 'E:\\Movies',
  folderName: 'familyflix-collection_08-10-2026',
};

function renderExport() {
  return renderHook(() => useExport(true));
}

describe('useExport — browse in a browser', () => {
  it('is null without the folder bridge', async () => {
    const { result } = renderExport();

    await waitFor(() => expect(result.current.destination).toBe('E:\\Movies'));
    expect(result.current.browse).toBeNull();
  });
});

describe('useExport — browse in the desktop app', () => {
  const bridge = fakeFolderBridge();

  it('is a call with the folder bridge', () => {
    const { result } = renderExport();

    expect(typeof result.current.browse).toBe('function');
  });

  it('opens the one-folder dialog', async () => {
    const { result } = renderExport();
    await waitFor(() => expect(result.current.destination).toBe('E:\\Movies'));

    await act(async () => {
      await result.current.browse?.();
    });

    expect(bridge.pickOnes()).toBe(1);
    expect(bridge.picks()).toBe(0);
  });

  it('writes the folder picked into Save to', async () => {
    bridge.setPickOne('F:\\Backup');
    const { result } = renderExport();
    await waitFor(() => expect(result.current.destination).toBe('E:\\Movies'));

    await act(async () => {
      await result.current.browse?.();
    });

    expect(result.current.destination).toBe('F:\\Backup');
  });

  it('writes over a path typed first', async () => {
    bridge.setPickOne('F:\\Backup');
    const { result } = renderExport();
    await waitFor(() => expect(result.current.destination).toBe('E:\\Movies'));
    act(() => result.current.setDestination('D:\\Typed'));

    await act(async () => {
      await result.current.browse?.();
    });

    expect(result.current.destination).toBe('F:\\Backup');
  });

  it('leaves Save to as it was on a cancel', async () => {
    bridge.setPickOne(null);
    const { result } = renderExport();
    await waitFor(() => expect(result.current.destination).toBe('E:\\Movies'));
    act(() => result.current.setDestination('D:\\Typed'));

    await act(async () => {
      await result.current.browse?.();
    });

    expect(bridge.pickOnes()).toBe(1);
    expect(result.current.destination).toBe('D:\\Typed');
  });

  it('leaves the default as it was on a cancel', async () => {
    bridge.setPickOne(null);
    const { result } = renderExport();
    await waitFor(() => expect(result.current.destination).toBe('E:\\Movies'));

    await act(async () => {
      await result.current.browse?.();
    });

    expect(bridge.pickOnes()).toBe(1);
    expect(result.current.destination).toBe('E:\\Movies');
  });
});
