import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import {
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { useSeriesRead } from './useSeriesRead';

const HARBOR = makeSeriesDetail([['watched', 'unwatched']]);
const LIGHTHOUSE = makeSeriesDetail([['unwatched']], {
  id: 'lighthouse',
  title: 'Lighthouse Keepers',
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

describe('useSeriesRead', () => {
  it('is loading, then ready with the read, addressed by the series’ id', async () => {
    fetchMock.mockResolvedValue(okResponse(HARBOR));

    const { result } = renderHook(() => useSeriesRead('harbor'));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.detail).toEqual({ ...HARBOR, id: 'harbor' });
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/series/harbor');
  });

  it('is not-found on a 404', async () => {
    fetchMock.mockResolvedValue(notFoundResponse());

    const { result } = renderHook(() => useSeriesRead('gone'));

    await waitFor(() => expect(result.current.status).toBe('not-found'));
    expect(result.current.detail).toBeNull();
  });

  it('is error on any other failure, and retry reads again', async () => {
    fetchMock
      .mockResolvedValueOnce(serverErrorResponse())
      .mockResolvedValueOnce(okResponse(HARBOR));

    const { result } = renderHook(() => useSeriesRead('harbor'));
    await waitFor(() => expect(result.current.status).toBe('error'));

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('drops a response that answers after the id has moved on', async () => {
    let answerFirst!: (response: Response) => void;
    fetchMock
      .mockImplementationOnce(
        () => new Promise((resolve) => (answerFirst = resolve))
      )
      .mockResolvedValueOnce(okResponse(LIGHTHOUSE));

    const { result, rerender } = renderHook(({ id }) => useSeriesRead(id), {
      initialProps: { id: 'harbor' },
    });
    rerender({ id: 'lighthouse' });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => answerFirst(okResponse(HARBOR)));

    expect(result.current.detail?.series.title).toBe('Lighthouse Keepers');
  });

  it('editSeries writes into the held read', async () => {
    fetchMock.mockResolvedValue(okResponse(HARBOR));
    const { result } = renderHook(() => useSeriesRead('harbor'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() =>
      result.current.editSeries((held) => ({
        ...held,
        series: { ...held.series, isFavorite: true },
      }))
    );

    expect(result.current.detail?.series.isFavorite).toBe(true);
  });

  it('editSeries writes nothing while nothing is held', () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));
    const { result } = renderHook(() => useSeriesRead('harbor'));
    const update = vi.fn((held) => held);

    act(() => result.current.editSeries(update));

    expect(update).not.toHaveBeenCalled();
    expect(result.current.status).toBe('loading');
  });
});
