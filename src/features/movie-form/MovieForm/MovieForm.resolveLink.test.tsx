import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { MovieForm } from './MovieForm';
import { theme } from '@/styles/theme';
import type { Genre, ImportProblemDetail } from '@/types';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 50 — Export paths, Phase 5 (issue #648): a Resolve in a Link run links.
 *
 * On a **Resolve** in the shell the picked video's path is read through the
 * **Path bridge** and checked with the containing read, as a plain add does.
 * Under a **Library folder** the pick travels as a **Found file** (its path,
 * `videoPath`, and no bytes), which the server places by the run's **Import
 * mode**: linked in a Link run, copied in a Copy run. Under none, or in a
 * browser, its bytes are uploaded and copied, as today. The Import mode
 * control is never drawn on a Resolve: the run already chose.
 *
 * The wire is a stubbed `fetch`; the bridge is `fakeFolderBridge`.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

const POOL: Genre[] = ['Action', 'Comedy', 'Drama'].map((name, index) => ({
  id: `g${index + 1}`,
  name,
}));

const LANTERN = 'Lantern.Keeper.2019.mp4';
const LANTERN_PATH = 'E:\\Films\\Loose\\Lantern.Keeper.2019.mp4';
const STRAY = 'Stray.2019.mp4';
const STRAY_PATH = 'D:\\Downloads\\Stray.2019.mp4';

/** What the containing read answers, by the path it was asked about. */
const CONTAINING: Record<string, string | null> = {
  [LANTERN_PATH]: 'films',
  [STRAY_PATH]: null,
};

/** A `no-folder` row: the sheet named the film, no folder held it. */
const LANTERN_NO_FOLDER: ImportProblemDetail = {
  id: 'p3',
  kind: 'no-folder',
  title: 'The Lantern Keeper',
  reason: 'No folder found matching this spreadsheet row.',
  row: { title: 'The Lantern Keeper', year: 2019, genres: ['Drama'] },
  candidates: [],
  files: { videos: [], subtitles: [] },
};

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    const method = init?.method?.toUpperCase() ?? 'GET';
    if (url.includes('/api/import/current/problems/')) {
      return Promise.resolve(
        method === 'POST'
          ? createdResponse(
              makeMovie({ id: 'm1', title: 'The Lantern Keeper' })
            )
          : okResponse(LANTERN_NO_FOLDER)
      );
    }
    if (url.includes('/api/library-folders/containing')) {
      const path =
        new URL(url, 'http://localhost').searchParams.get('path') ?? '';
      return Promise.resolve(
        okResponse({ libraryFolderId: CONTAINING[path] ?? null })
      );
    }
    return Promise.resolve(okResponse({ genres: POOL }));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The form opened by _Resolve_ on the review, every read on mount settled. */
async function renderResolve() {
  const view = render(
    <MemoryRouter
      initialEntries={['/settings', '/import', '/add?problem=p3']}
      initialIndex={2}
    >
      <ThemeProvider theme={theme}>
        <MovieForm />
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
  await act(async () => undefined);
  await act(async () => undefined);
  return view;
}

const choice = () => screen.queryByRole('radiogroup', { name: 'Link or copy' });

const videoPicker = () =>
  screen.getByLabelText(/choose video file/i) as HTMLInputElement;

async function pickVideo(name: string): Promise<File> {
  const file = new File(['video bytes'], name, { type: 'video/mp4' });
  await userEvent.upload(videoPicker(), file, { applyAccept: false });
  await act(async () => undefined);
  return file;
}

const saveAndContinue = () =>
  screen.getByRole('button', {
    name: /save & continue|saving/i,
  }) as HTMLButtonElement;

const resolveRequests = () =>
  fetchMock.mock.calls.filter(
    ([input, init]) =>
      init?.method?.toUpperCase() === 'POST' &&
      String(input).includes('/api/import/current/problems/')
  );

const containingReads = () =>
  fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/api/library-folders/containing'));

/** Press _Save & continue_ and answer the resolve's one body. */
async function resolvedBody(): Promise<FormData> {
  fireEvent.click(saveAndContinue());
  await waitFor(() => expect(resolveRequests()).toHaveLength(1));
  expect(String(resolveRequests()[0][0])).toBe(
    '/api/import/current/problems/p3/resolve'
  );
  return resolveRequests()[0][1]?.body as FormData;
}

/** Every part of a body that carried a file's bytes. */
const bytesIn = (body: FormData): File[] =>
  ['video', 'poster', 'subtitle']
    .flatMap((name) => body.getAll(name))
    .filter((value): value is File => value instanceof File);

describe('MovieForm — the Resolve in the shell', () => {
  const bridge = fakeFolderBridge();

  beforeEach(() => {
    bridge.setPathOf(LANTERN, LANTERN_PATH);
    bridge.setPathOf(STRAY, STRAY_PATH);
  });

  it('asks the containing read about the picked video’s path', async () => {
    await renderResolve();

    await pickVideo(LANTERN);

    await waitFor(() => expect(containingReads()).toHaveLength(1));
    const asked = new URL(containingReads()[0], 'http://localhost');
    expect(asked.searchParams.get('path')).toBe(LANTERN_PATH);
  });

  it('sends a pick under a Library folder as its path, so a Link run links it where it lies', async () => {
    await renderResolve();
    await pickVideo(LANTERN);
    await waitFor(() => expect(containingReads()).toHaveLength(1));

    const body = await resolvedBody();

    expect(body.get('videoPath')).toBe(LANTERN_PATH);
    expect(body.get('video')).toBeNull();
    expect(bytesIn(body)).toEqual([]);
  });

  it('sends the same path in a Copy run, whose own mode copies it', async () => {
    // The run holds its Import mode; the form sends no mode on a Resolve, so
    // a Copy run's resolve is the same body, and the server copies the file.
    await renderResolve();
    await pickVideo(LANTERN);
    await waitFor(() => expect(containingReads()).toHaveLength(1));

    const body = await resolvedBody();

    expect(body.get('mode')).toBeNull();
    expect(body.get('videoPath')).toBe(LANTERN_PATH);
    expect(bytesIn(body)).toEqual([]);
  });

  it('sends the bytes of a pick under no Library folder, to be copied', async () => {
    await renderResolve();
    const file = await pickVideo(STRAY);
    await waitFor(() => expect(containingReads()).toHaveLength(1));

    const body = await resolvedBody();

    expect(body.get('videoPath')).toBeNull();
    expect(body.get('video')).toBeInstanceOf(File);
    expect((body.get('video') as File).name).toBe(file.name);
  });

  it('draws no Import mode control, even after a pick under a Library folder', async () => {
    await renderResolve();
    expect(screen.getByText(/resolving import/i)).toBeDefined();
    expect(choice()).toBeNull();

    await pickVideo(LANTERN);
    await waitFor(() => expect(containingReads()).toHaveLength(1));

    expect(choice()).toBeNull();
  });
});

describe('MovieForm — the Resolve in a browser', () => {
  it('sends the picked video’s bytes, to be copied, as today', async () => {
    await renderResolve();
    const file = await pickVideo(LANTERN);

    const body = await resolvedBody();

    expect(containingReads()).toEqual([]);
    expect(body.get('videoPath')).toBeNull();
    expect(body.get('video')).toBeInstanceOf(File);
    expect((body.get('video') as File).name).toBe(file.name);
  });
});
