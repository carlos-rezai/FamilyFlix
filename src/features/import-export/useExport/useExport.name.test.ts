import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useExport } from './useExport';
import type { ExportResult, ExportSummary } from '@/types';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 36 — Export name (issue #295).
 *
 * `useExport(open)` gains the **Folder name field**'s `name` and `setName`.
 * The name fills from the summary's `defaultName` once it lands, never over a
 * name typed first — _Save to_'s rule — and every open resets it. The name is
 * posted as `StartExport.name`. A `400`'s `refusal` becomes `{ field, sentence
 * }`, one at a time, so the dialog can draw it under the field it is about,
 * and it is kept until the next press.
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
  defaultName: 'familyflix-collection_08-10-2026',
};

const RESULT: ExportResult = {
  folder: 'E:\\Movies\\Family films',
  movieCount: 3,
  seriesCount: 1,
};

type Call = [RequestInfo | URL, RequestInit?];

const isExportPost = ([input, init]: Call) =>
  String(input).endsWith('/api/export') && init?.method === 'POST';

/** Every body POSTed to the export route so far, parsed. */
const posts = (): unknown[] =>
  fetchMock.mock.calls
    .filter((call) => isExportPost(call))
    .map(([, init]) => JSON.parse(String(init?.body)) as unknown);

/** A 400 carrying the route's sentence and the field it names. */
function refused(field: string, error: string): Response {
  return {
    ok: false,
    status: 400,
    json: () => Promise.resolve({ error, field }),
  } as unknown as Response;
}

/** A promise the test settles when it says so. */
function held() {
  let settle: (response: Response) => void = () => undefined;
  const pending = new Promise<Response>((resolve) => {
    settle = resolve;
  });
  return {
    answer: () => pending,
    settle: (response: Response) => settle(response),
  };
}

/** A server whose summary answers `summary`, and whose export answers `post`. */
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

describe('useExport — the default name', () => {
  it('opens with no name before the summary lands', () => {
    serve({ summary: () => new Promise<Response>(() => undefined) });

    const { result } = renderExport();

    expect(result.current.name).toBe('');
  });

  it('fills the name from the summary’s defaultName once it lands', async () => {
    serve();

    const { result } = renderExport();

    await waitFor(() =>
      expect(result.current.name).toBe('familyflix-collection_08-10-2026')
    );
  });

  it('takes what is typed', () => {
    serve({ summary: () => new Promise<Response>(() => undefined) });
    const { result } = renderExport();

    act(() => result.current.setName('Family films'));

    expect(result.current.name).toBe('Family films');
  });

  it('never writes the default over a name typed before it landed', async () => {
    const summary = held();
    serve({ summary: summary.answer });
    const { result } = renderExport();

    act(() => result.current.setName('Family films'));
    await act(async () => {
      summary.settle(okResponse(SUMMARY));
    });

    await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));
    expect(result.current.name).toBe('Family films');
  });

  it('never writes the default over a name emptied before it landed', async () => {
    const summary = held();
    serve({ summary: summary.answer });
    const { result } = renderExport();

    act(() => result.current.setName('x'));
    act(() => result.current.setName(''));
    await act(async () => {
      summary.settle(okResponse(SUMMARY));
    });

    await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));
    expect(result.current.name).toBe('');
  });

  it('keeps filling the destination when only the name was typed', async () => {
    const summary = held();
    serve({ summary: summary.answer });
    const { result } = renderExport();

    act(() => result.current.setName('Family films'));
    await act(async () => {
      summary.settle(okResponse(SUMMARY));
    });

    await waitFor(() => expect(result.current.destination).toBe('E:\\Movies'));
  });

  it('keeps filling the name when only the destination was typed', async () => {
    const summary = held();
    serve({ summary: summary.answer });
    const { result } = renderExport();

    act(() => result.current.setDestination('D:\\Backups'));
    await act(async () => {
      summary.settle(okResponse(SUMMARY));
    });

    await waitFor(() =>
      expect(result.current.name).toBe('familyflix-collection_08-10-2026')
    );
  });
});

describe('useExport — sending the name', () => {
  it('posts the default name when nothing was typed', async () => {
    serve();
    const { result } = renderExport();
    await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(posts()).toEqual([
      expect.objectContaining({ name: 'familyflix-collection_08-10-2026' }),
    ]);
  });

  it('posts the name typed, exactly as typed', async () => {
    serve();
    const { result } = renderExport();
    await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));
    act(() => result.current.setName('  Family films '));

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(posts()).toEqual([
      expect.objectContaining({ name: '  Family films ' }),
    ]);
  });
});

describe('useExport — a refusal carries its field', () => {
  it('holds a name refusal as its field and sentence', async () => {
    serve({
      post: () =>
        Promise.resolve(refused('name', 'Give the export folder a name.')),
    });
    const { result } = renderExport();

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(result.current.refusal).toEqual({
      field: 'name',
      sentence: 'Give the export folder a name.',
    });
    expect(result.current.result).toBeNull();
    expect(result.current.exporting).toBe(false);
  });

  it('holds a destination refusal as its field and sentence', async () => {
    serve({
      post: () =>
        Promise.resolve(refused('destination', 'No folder at that path.')),
    });
    const { result } = renderExport();

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(result.current.refusal).toEqual({
      field: 'destination',
      sentence: 'No folder at that path.',
    });
  });

  it('keeps the refused name in the field', async () => {
    serve({
      post: () =>
        Promise.resolve(
          refused('name', "A folder name can't end in a space or a dot.")
        ),
    });
    const { result } = renderExport();
    act(() => result.current.setName('Family.'));

    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(result.current.name).toBe('Family.');
  });

  it('keeps the refusal while the name is edited, until the next press', async () => {
    serve({
      post: () =>
        Promise.resolve(refused('name', 'Give the export folder a name.')),
    });
    const { result } = renderExport();
    await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));
    act(() => result.current.setName(''));
    await act(async () => {
      await result.current.exportLibrary();
    });

    act(() => result.current.setName('Family films'));
    act(() => result.current.setDestination('D:\\Backups'));

    expect(result.current.refusal).toEqual({
      field: 'name',
      sentence: 'Give the export folder a name.',
    });
  });

  it('answers the next press’s refusal in place of the last', async () => {
    const answers = [
      refused('name', 'Give the export folder a name.'),
      refused('destination', 'No folder at that path.'),
    ];
    serve({ post: () => Promise.resolve(answers.shift() as Response) });
    const { result } = renderExport();

    await act(async () => {
      await result.current.exportLibrary();
    });
    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(result.current.refusal).toEqual({
      field: 'destination',
      sentence: 'No folder at that path.',
    });
  });

  it('clears the refusal when the next press writes the folder', async () => {
    const answers = [
      refused('name', 'Give the export folder a name.'),
      createdResponse(RESULT),
    ];
    serve({ post: () => Promise.resolve(answers.shift() as Response) });
    const { result } = renderExport();

    await act(async () => {
      await result.current.exportLibrary();
    });
    expect(result.current.refusal).toEqual({
      field: 'name',
      sentence: 'Give the export folder a name.',
    });
    await act(async () => {
      await result.current.exportLibrary();
    });

    expect(result.current.refusal).toBeNull();
    expect(result.current.result).toEqual(RESULT);
  });
});

describe('useExport — every open resets the name', () => {
  it('puts the typed name back to empty, then to the default, on a reopen', async () => {
    serve({
      post: () =>
        Promise.resolve(refused('name', 'Give the export folder a name.')),
    });
    const { result, rerender } = renderExport();
    await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));
    act(() => result.current.setName('Family films'));
    await act(async () => {
      await result.current.exportLibrary();
    });

    rerender({ open: false });
    const later = held();
    serve({ summary: later.answer });
    rerender({ open: true });

    expect(result.current.name).toBe('');
    expect(result.current.refusal).toBeNull();

    await act(async () => {
      later.settle(okResponse(SUMMARY));
    });
    await waitFor(() =>
      expect(result.current.name).toBe('familyflix-collection_08-10-2026')
    );
  });

  it('forgets that the name was edited, so the next open fills it again', async () => {
    const first = held();
    serve({ summary: first.answer });
    const { result, rerender } = renderExport();
    act(() => result.current.setName('Family films'));

    rerender({ open: false });
    serve();
    rerender({ open: true });

    await waitFor(() =>
      expect(result.current.name).toBe('familyflix-collection_08-10-2026')
    );
  });
});
