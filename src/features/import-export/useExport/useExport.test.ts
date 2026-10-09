import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useExport } from './useExport';
import type { ExportResult, ExportSummary } from '@/types';
import {
  createdResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 31 — Export options, Phase 1: "the tracer" (issue #276).
 *
 * `useExport(open)` — what the **Export dialog** holds, now that the server
 * writes the export straight to a folder: the chosen **Export format**, the
 * grown **Export summary** (`null` until it lands), the _Save to_
 * `destination` and its setter, whether a request is in flight, the
 * `refusal` sentence a `400` said, and the `result` a `201` answered — which
 * is **Export ready**.
 *
 * Every open resets all of it. `destination` fills from the summary's
 * `defaultDestination` once it lands, but never over a path typed first
 * (`useTmdbKey`'s rule). `exportLibrary()` posts a `StartExport` with images
 * and subtitles off until Phases 3 and 4. A `201` sets `result`; a `400` sets
 * `refusal` and keeps the idle face; any other failure leaves the dialog as it
 * was; a close mid-request drops the redraw, not the export.
 *
 * Asserted as requests against a stubbed `fetch` and as what the hook hands
 * its dialog.
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

const SUMMARY: ExportSummary = {
  movieCount: 3,
  seriesCount: 1,
  episodeCount: 8,
  defaultDestination: 'E:\\Movies',
  folderName: 'familyflix-collection_08-10-2026',
};

const RESULT: ExportResult = {
  folder: 'E:\\Movies\\familyflix-collection_08-10-2026',
  movieCount: 3,
  seriesCount: 1,
};

type Call = [RequestInfo | URL, RequestInit?];

const isSummaryRead = ([input, init]: Call) =>
  String(input).endsWith('/api/export') &&
  (init?.method === undefined || init.method === 'GET');
const isExportPost = ([input, init]: Call) =>
  String(input).endsWith('/api/export') && init?.method === 'POST';

const summaryReads = () =>
  fetchMock.mock.calls.filter((call) => isSummaryRead(call)).length;

/** Every body POSTed to the export route so far, parsed. */
const posts = (): unknown[] =>
  fetchMock.mock.calls
    .filter((call) => isExportPost(call))
    .map(([, init]) => JSON.parse(String(init?.body)) as unknown);

/** A 400 carrying the route's one sentence. */
function badRequest(error: string): Response {
  return {
    ok: false,
    status: 400,
    json: () => Promise.resolve({ error }),
  } as unknown as Response;
}

/** A promise the test settles when it says so. */
function held() {
  let settle: (response: Response) => void = () => undefined;
  let refuse: (reason: Error) => void = () => undefined;
  const pending = new Promise<Response>((resolve, reject) => {
    settle = resolve;
    refuse = reject;
  });
  return {
    answer: () => pending,
    settle: (response: Response) => settle(response),
    refuse: (reason: Error) => refuse(reason),
  };
}

/**
 * A server whose summary answers `summary` (or fails, or is held), and whose
 * export route answers `post`.
 */
function serve({
  summary = () => Promise.resolve(okResponse(SUMMARY)),
  post = () => Promise.resolve(createdResponse(RESULT)),
}: {
  summary?: () => Promise<Response>;
  post?: () => Promise<Response>;
} = {}) {
  fetchMock.mockImplementation((input, init) =>
    isExportPost([input, init]) ? post() : summary()
  );
}

function renderExport(open = true) {
  return renderHook(({ open: isOpen }) => useExport(isOpen), {
    initialProps: { open },
  });
}

describe('useExport — opening', () => {
  it('opens on csv, idle, with nothing typed, refused or written', () => {
    serve({ summary: () => new Promise<Response>(() => undefined) });

    const { result } = renderExport();

    expect(result.current.format).toBe('csv');
    expect(result.current.summary).toBeNull();
    expect(result.current.destination).toBe('');
    expect(result.current.refusal).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.exporting).toBe(false);
  });

  it('reads the summary once on open, and nothing while closed', async () => {
    serve();

    const { rerender } = renderExport(false);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();

    rerender({ open: true });
    await waitFor(() => expect(summaryReads()).toBe(1));
  });

  it('holds the whole summary once it lands', async () => {
    serve();

    const { result } = renderExport();

    await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));
  });

  it('keeps the summary null when it fails', async () => {
    serve({ summary: () => Promise.resolve(serverErrorResponse()) });

    const { result } = renderExport();

    await waitFor(() => expect(summaryReads()).toBe(1));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.summary).toBeNull();
    expect(result.current.destination).toBe('');
  });
});

describe('useExport — the default destination', () => {
  it('fills Save to from the summary’s default once it lands', async () => {
    serve();

    const { result } = renderExport();

    await waitFor(() => expect(result.current.destination).toBe('E:\\Movies'));
  });

  it('takes what is typed', () => {
    serve({ summary: () => new Promise<Response>(() => undefined) });
    const { result } = renderExport();

    act(() => result.current.setDestination('D:\\Backups'));

    expect(result.current.destination).toBe('D:\\Backups');
  });

  it('never writes the default over a path typed before it landed', async () => {
    const summary = held();
    serve({ summary: summary.answer });
    const { result } = renderExport();

    act(() => result.current.setDestination('D:\\Backups'));
    await act(async () => {
      summary.settle(okResponse(SUMMARY));
    });

    await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));
    expect(result.current.destination).toBe('D:\\Backups');
  });
});

describe('useExport — exporting', () => {
  it('posts the format and the destination, with images and subtitles off', async () => {
    serve();
    const { result } = renderExport();
    await waitFor(() => expect(result.current.destination).toBe('E:\\Movies'));
    act(() => result.current.chooseFormat('xlsx'));

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(posts()).toEqual([
      {
        format: 'xlsx',
        destination: 'E:\\Movies',
        images: false,
        subtitles: false,
      },
    ]);
  });

  it('posts the path typed, not the default', async () => {
    serve();
    const { result } = renderExport();
    await waitFor(() => expect(result.current.destination).toBe('E:\\Movies'));
    act(() => result.current.setDestination('D:\\Backups'));

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(posts()).toEqual([
      expect.objectContaining({ destination: 'D:\\Backups' }),
    ]);
  });

  it('is exporting for the life of the request, and not before', async () => {
    const request = held();
    serve({ post: request.answer });
    const { result } = renderExport();
    expect(result.current.exporting).toBe(false);

    act(() => {
      void result.current.exportLibrary();
    });
    await waitFor(() => expect(result.current.exporting).toBe(true));

    await act(async () => {
      request.settle(createdResponse(RESULT));
    });
    await waitFor(() => expect(result.current.exporting).toBe(false));
  });

  it('sets result on a 201 — Export ready', async () => {
    serve();
    const { result } = renderExport();

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(result.current.result).toEqual(RESULT);
    expect(result.current.refusal).toBeNull();
  });
});

describe('useExport — a refused destination (400)', () => {
  it('sets the refusal sentence and keeps the idle face', async () => {
    serve({
      post: () => Promise.resolve(badRequest('No folder at that path.')),
    });
    const { result } = renderExport();

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(result.current.refusal).toBe('No folder at that path.');
    expect(result.current.result).toBeNull();
    expect(result.current.exporting).toBe(false);
  });

  it('keeps the path that was refused in the field', async () => {
    serve({
      post: () => Promise.resolve(badRequest('No folder at that path.')),
    });
    const { result } = renderExport();
    act(() => result.current.setDestination('Q:\\Nowhere'));

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(result.current.destination).toBe('Q:\\Nowhere');
  });
});

describe('useExport — any other failure', () => {
  it('leaves the dialog as it was on a 500', async () => {
    serve({ post: () => Promise.resolve(serverErrorResponse()) });
    const { result } = renderExport();
    await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));
    act(() => result.current.chooseFormat('xlsx'));

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(result.current.exporting).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.refusal).toBeNull();
    expect(result.current.format).toBe('xlsx');
    expect(result.current.destination).toBe('E:\\Movies');
    expect(result.current.summary).toEqual(SUMMARY);
  });

  it('leaves the dialog as it was when the request could not be made', async () => {
    serve({ post: () => Promise.reject(new Error('offline')) });
    const { result } = renderExport();

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(result.current.exporting).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.refusal).toBeNull();
  });

  it('does not reject the caller', async () => {
    serve({ post: () => Promise.resolve(serverErrorResponse()) });
    const { result } = renderExport();

    await expect(
      act(async () => {
        await result.current.exportLibrary();
      })
    ).resolves.toBeUndefined();
  });
});

describe('useExport — a close mid-request', () => {
  it('still sends the export, and drops the redraw', async () => {
    const request = held();
    serve({ post: request.answer });
    const { result, rerender } = renderExport();

    act(() => {
      void result.current.exportLibrary();
    });
    await waitFor(() => expect(result.current.exporting).toBe(true));

    rerender({ open: false });
    await act(async () => {
      request.settle(createdResponse(RESULT));
    });

    expect(posts()).toHaveLength(1);
    expect(result.current.result).toBeNull();
  });

  it('drops a refusal that lands after the close, too', async () => {
    const request = held();
    serve({ post: request.answer });
    const { result, rerender } = renderExport();

    act(() => {
      void result.current.exportLibrary();
    });
    await waitFor(() => expect(result.current.exporting).toBe(true));

    rerender({ open: false });
    await act(async () => {
      request.settle(badRequest('No folder at that path.'));
    });

    expect(result.current.refusal).toBeNull();
  });
});

describe('useExport — every open resets the state', () => {
  it('resets the format, the field, the refusal and the result, and reads afresh', async () => {
    serve({
      post: () => Promise.resolve(badRequest('No folder at that path.')),
    });
    const { result, rerender } = renderExport();
    await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));
    act(() => result.current.chooseFormat('xlsx'));
    act(() => result.current.setDestination('Q:\\Nowhere'));
    await act(async () => {
      await result.current.exportLibrary();
    });
    expect(result.current.refusal).toBe('No folder at that path.');

    rerender({ open: false });
    const later = held();
    serve({ summary: later.answer });
    rerender({ open: true });

    expect(result.current.format).toBe('csv');
    expect(result.current.summary).toBeNull();
    expect(result.current.destination).toBe('');
    expect(result.current.refusal).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.exporting).toBe(false);
    await waitFor(() => expect(summaryReads()).toBe(2));
  });

  it('forgets Export ready on a reopen, and fills the default again', async () => {
    serve();
    const { result, rerender } = renderExport();
    await act(async () => {
      await result.current.exportLibrary();
    });
    expect(result.current.result).toEqual(RESULT);

    rerender({ open: false });
    serve({
      summary: () =>
        Promise.resolve(
          okResponse({ ...SUMMARY, defaultDestination: 'F:\\Films' })
        ),
    });
    rerender({ open: true });

    expect(result.current.result).toBeNull();
    await waitFor(() => expect(result.current.destination).toBe('F:\\Films'));
  });
});
