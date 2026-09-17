import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useExport } from './useExport';
import { stubDownload } from '@/test-support/stubDownload/stubDownload';
import {
  fileResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 14 — Export, Phase 1: "the tracer bullet" (issue #137).
 *
 * `useExport(open)` — what the **Export dialog** holds: the chosen **Export
 * format**, the **Export summary**'s count, whether a request is in flight and
 * whether **Export ready** has been reached. On open it resets to `csv` and
 * idle and fetches the summary; `movieCount` is `null` until it lands and
 * stays `null` if it never does — the count never blocks the export.
 * `exportLibrary` fetches the format's route, hands the blob to **Save to
 * computer** under the format's filename, and only then sets `done`.
 *
 * A rejected fetch clears `exporting` and changes nothing else — the Delete
 * dialog's rule, and the hook's shape from its first commit. Phase 1 (#137)
 * had _Export as Excel_ meet that rule on every press, because the route
 * answered `400` for `xlsx` until the writer's second arm existed; Phase 2
 * (#138) gave it the arm, and the hook never told the formats apart, so
 * nothing here changed but the story the refusal tells.
 *
 * Everything is asserted as requests against a stubbed `fetch`, and as what
 * the browser was handed through `stubDownload`.
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

const isSummary = ([input]: [RequestInfo | URL, RequestInit?]) =>
  String(input).endsWith('/api/export');
const isFile = ([input]: [RequestInfo | URL, RequestInit?]) =>
  /\/api\/export\/[a-z]+$/.test(String(input));

/** Every read of the summary route so far. */
const summaryReads = () => fetchMock.mock.calls.filter(isSummary).length;

/** The file routes asked for so far, by their last segment. */
const fileRequests = () =>
  fetchMock.mock.calls
    .filter(isFile)
    .map(([input]) => String(input).split('/').pop());

const csv = () =>
  new Blob(['\uFEFFTitle,Year\nDie Hard,1988\n'], {
    type: 'text/csv; charset=utf-8',
  });

/**
 * A server with a library of `movieCount` movies. The summary answers the
 * count (or falls over); the file route answers `file` — the bytes, or a
 * refusal.
 */
function serve({
  movieCount = 3,
  summary = 'ok',
  file = () => fileResponse(csv()),
}: {
  movieCount?: number;
  summary?: 'ok' | 'failing' | 'offline';
  file?: () => Promise<Response> | Response;
} = {}) {
  fetchMock.mockImplementation((input) => {
    if (isSummary([input])) {
      if (summary === 'offline') {
        return Promise.reject(new Error('offline'));
      }
      return Promise.resolve(
        summary === 'ok' ? okResponse({ movieCount }) : serverErrorResponse()
      );
    }
    return Promise.resolve(file());
  });
}

/** A file route that answers only when the test says so. */
function holdFile() {
  let settle: (response: Response) => void = () => undefined;
  let refuse: (reason: Error) => void = () => undefined;
  const pending = new Promise<Response>((resolve, reject) => {
    settle = resolve;
    refuse = reject;
  });
  return {
    file: () => pending,
    settle: (response: Response) => settle(response),
    refuse: (reason: Error) => refuse(reason),
  };
}

function renderExport(open = true) {
  return renderHook(({ open: isOpen }) => useExport(isOpen), {
    initialProps: { open },
  });
}

describe('useExport — opening', () => {
  it('opens on csv, idle', () => {
    serve();

    const { result } = renderExport();

    expect(result.current.format).toBe('csv');
    expect(result.current.exporting).toBe(false);
    expect(result.current.done).toBe(false);
  });

  it('fetches the summary once on open', async () => {
    serve();

    renderExport();

    await waitFor(() => expect(summaryReads()).toBe(1));
    expect(fileRequests()).toEqual([]);
  });

  it('fetches nothing while closed', async () => {
    serve();

    renderExport(false);

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('holds a null count until the summary lands, then the count', async () => {
    const summary = holdFile();
    fetchMock.mockImplementation(() => summary.file());

    const { result } = renderExport();

    expect(result.current.movieCount).toBeNull();
    await act(async () => {
      summary.settle(okResponse({ movieCount: 3 }));
    });
    await waitFor(() => expect(result.current.movieCount).toBe(3));
  });

  it('answers a count of 0 for an empty library, not null', async () => {
    serve({ movieCount: 0 });

    const { result } = renderExport();

    await waitFor(() => expect(result.current.movieCount).toBe(0));
  });

  it('keeps the count null when the summary fails', async () => {
    serve({ summary: 'failing' });

    const { result } = renderExport();

    await waitFor(() => expect(summaryReads()).toBe(1));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.movieCount).toBeNull();
    expect(result.current.exporting).toBe(false);
    expect(result.current.done).toBe(false);
  });

  it('keeps the count null when the summary cannot be requested', async () => {
    serve({ summary: 'offline' });

    const { result } = renderExport();

    await waitFor(() => expect(summaryReads()).toBe(1));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.movieCount).toBeNull();
  });
});

describe('useExport — choosing the format', () => {
  it('switches to xlsx and back', () => {
    serve();
    const { result } = renderExport();

    act(() => result.current.chooseFormat('xlsx'));
    expect(result.current.format).toBe('xlsx');

    act(() => result.current.chooseFormat('csv'));
    expect(result.current.format).toBe('csv');
  });

  it('fetches nothing for a choice — the count is the library’s, not the format’s', async () => {
    serve();
    const { result } = renderExport();
    await waitFor(() => expect(summaryReads()).toBe(1));

    act(() => result.current.chooseFormat('xlsx'));

    expect(summaryReads()).toBe(1);
    expect(fileRequests()).toEqual([]);
  });
});

describe('useExport — exporting', () => {
  const browser = stubDownload();

  it('fetches the CSV route for csv', async () => {
    serve();
    const { result } = renderExport();

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(fileRequests()).toEqual(['csv']);
  });

  it('fetches the Excel route for xlsx', async () => {
    serve();
    const { result } = renderExport();
    act(() => result.current.chooseFormat('xlsx'));

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(fileRequests()).toEqual(['xlsx']);
  });

  it('is exporting for the life of the request, and not before', async () => {
    const request = holdFile();
    serve({ file: request.file });
    const { result } = renderExport();
    expect(result.current.exporting).toBe(false);

    act(() => {
      void result.current.exportLibrary();
    });

    await waitFor(() => expect(result.current.exporting).toBe(true));
    expect(result.current.done).toBe(false);

    await act(async () => {
      request.settle(fileResponse(csv()));
    });

    await waitFor(() => expect(result.current.exporting).toBe(false));
  });

  it('hands the blob to the browser under the CSV filename', async () => {
    const blob = csv();
    serve({ file: () => fileResponse(blob) });
    const { result } = renderExport();

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(browser.downloads()).toHaveLength(1);
    expect(browser.downloads()[0]).toMatchObject({
      blob,
      filename: 'family-library.csv',
    });
  });

  it('hands the blob to the browser under the Excel filename for xlsx', async () => {
    serve();
    const { result } = renderExport();
    act(() => result.current.chooseFormat('xlsx'));

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(browser.downloads()[0].filename).toBe('family-library.xlsx');
  });

  it('is done only once the browser has been handed the file', async () => {
    const request = holdFile();
    serve({ file: request.file });
    const { result } = renderExport();

    act(() => {
      void result.current.exportLibrary();
    });
    await waitFor(() => expect(result.current.exporting).toBe(true));
    expect(result.current.done).toBe(false);
    expect(browser.downloads()).toHaveLength(0);

    await act(async () => {
      request.settle(fileResponse(csv()));
    });

    await waitFor(() => expect(result.current.done).toBe(true));
    expect(browser.downloads()).toHaveLength(1);
    expect(result.current.exporting).toBe(false);
  });

  it('keeps the format and the count through the export', async () => {
    serve({ movieCount: 3 });
    const { result } = renderExport();
    await waitFor(() => expect(result.current.movieCount).toBe(3));
    act(() => result.current.chooseFormat('xlsx'));

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(result.current.format).toBe('xlsx');
    expect(result.current.movieCount).toBe(3);
  });

  it('exports before the summary has landed — the count never blocks it', async () => {
    const summary = holdFile();
    fetchMock.mockImplementation((input) =>
      isSummary([input]) ? summary.file() : Promise.resolve(fileResponse(csv()))
    );
    const { result } = renderExport();
    expect(result.current.movieCount).toBeNull();

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(result.current.done).toBe(true);
    expect(browser.downloads()).toHaveLength(1);
  });
});

describe('useExport — a request the server refuses', () => {
  const browser = stubDownload();

  it('clears exporting and leaves done false on a 500', async () => {
    const request = holdFile();
    serve({ file: request.file });
    const { result } = renderExport();

    act(() => {
      void result.current.exportLibrary();
    });
    await waitFor(() => expect(result.current.exporting).toBe(true));

    await act(async () => {
      request.settle(serverErrorResponse());
    });

    await waitFor(() => expect(result.current.exporting).toBe(false));
    expect(result.current.done).toBe(false);
    expect(browser.downloads()).toHaveLength(0);
  });

  it('keeps the format the maintainer chose when the Excel request is refused', async () => {
    serve({ file: () => serverErrorResponse() });
    const { result } = renderExport();
    act(() => result.current.chooseFormat('xlsx'));

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(result.current.format).toBe('xlsx');
    expect(result.current.exporting).toBe(false);
    expect(result.current.done).toBe(false);
    expect(browser.downloads()).toHaveLength(0);
  });

  it('keeps the count the summary answered', async () => {
    serve({ movieCount: 3, file: () => serverErrorResponse() });
    const { result } = renderExport();
    await waitFor(() => expect(result.current.movieCount).toBe(3));

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(result.current.movieCount).toBe(3);
  });

  it('clears exporting when the request could not be made at all', async () => {
    const request = holdFile();
    serve({ file: request.file });
    const { result } = renderExport();

    act(() => {
      void result.current.exportLibrary();
    });
    await waitFor(() => expect(result.current.exporting).toBe(true));

    await act(async () => {
      request.refuse(new Error('offline'));
    });

    await waitFor(() => expect(result.current.exporting).toBe(false));
    expect(result.current.done).toBe(false);
  });

  it('does not reject the caller — the refusal is a state, not an error', async () => {
    serve({ file: () => serverErrorResponse() });
    const { result } = renderExport();

    await expect(
      act(async () => {
        await result.current.exportLibrary();
      })
    ).resolves.toBeUndefined();
  });

  it('can be asked again from the same idle face', async () => {
    let attempts = 0;
    serve({
      file: () => {
        attempts += 1;
        return attempts === 1 ? serverErrorResponse() : fileResponse(csv());
      },
    });
    const { result } = renderExport();

    await act(async () => {
      await result.current.exportLibrary();
    });
    expect(result.current.done).toBe(false);

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(result.current.done).toBe(true);
    expect(fileRequests()).toEqual(['csv', 'csv']);
    expect(browser.downloads()).toHaveLength(1);
  });
});

describe('useExport — a close mid-request', () => {
  const browser = stubDownload();

  it('still lands the file, and never reaches done', async () => {
    const request = holdFile();
    serve({ file: request.file });
    const { result, rerender } = renderExport();

    act(() => {
      void result.current.exportLibrary();
    });
    await waitFor(() => expect(result.current.exporting).toBe(true));

    // Cancel while the bytes are on their way. The maintainer asked for the
    // file, and a download the browser has been handed cannot be recalled, so
    // it lands; what the close drops is the Export ready face.
    rerender({ open: false });
    await act(async () => {
      request.settle(fileResponse(csv()));
    });

    expect(browser.downloads()).toHaveLength(1);
    expect(browser.downloads()[0].filename).toBe('family-library.csv');
    expect(result.current.done).toBe(false);
  });
});

describe('useExport — reopening', () => {
  stubDownload();

  it('resets to csv and idle, and fetches a fresh summary', async () => {
    serve({ movieCount: 3 });
    const { result, rerender } = renderExport();
    await waitFor(() => expect(result.current.movieCount).toBe(3));
    act(() => result.current.chooseFormat('xlsx'));
    await act(async () => {
      await result.current.exportLibrary();
    });
    expect(result.current.done).toBe(true);

    rerender({ open: false });
    serve({ movieCount: 4 });
    rerender({ open: true });

    expect(result.current.format).toBe('csv');
    expect(result.current.done).toBe(false);
    expect(result.current.exporting).toBe(false);
    await waitFor(() => expect(result.current.movieCount).toBe(4));
    expect(summaryReads()).toBe(2);
  });
});
