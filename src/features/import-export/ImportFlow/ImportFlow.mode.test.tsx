import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ImportFlow } from './ImportFlow';
import { theme } from '@/styles/theme';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  createdResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 41 — Link or copy, Slice 4: "shows and the sheet link" (issue #344).
 *
 * **Import setup** draws the **Import mode** (`ImportModeChoice`) above the
 * _Also fetch metadata and posters from TMDB_ card: the _Files_ caption over
 * two radios, **Link** chosen on every mount and never remembered, and
 * _Start import_ posts the chosen `mode` beside `sheetPath` and `enrich` in
 * `POST /api/import` — the Library folders page's choice, on the sheet start.
 *
 * The seam is `fetch` and the router, as in `ImportFlow.enrich.test.tsx`.
 */

const SHEET = 'C:\\Movies\\library.xlsx';
const ENRICH_LABEL = /Also fetch metadata and posters from TMDB/;

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const method = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const path = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').pathname;

const isStart = (input: RequestInfo | URL, init?: RequestInit) =>
  path(input) === '/api/import' && method(init) === 'POST';

/** A server with one listed folder, a stored key, and no run until a start. */
function serve() {
  let running = false;
  const started = makeImportRun();
  fetchMock.mockImplementation((input, init) => {
    const p = path(input);
    if (p === '/api/tmdb/key' && method(init) === 'GET') {
      return Promise.resolve(okResponse({ key: '0123456789abcdef' }));
    }
    if (p === '/api/library-folders' && method(init) === 'GET') {
      return Promise.resolve(
        okResponse([
          {
            id: 'f-movies',
            path: 'E:\\Movies',
            titleCount: 12,
            reachable: true,
          },
        ])
      );
    }
    if (isStart(input, init)) {
      running = true;
      return Promise.resolve(createdResponse(started));
    }
    if (p === '/api/import/current' && method(init) === 'GET') {
      return Promise.resolve(
        running ? okResponse(started) : notFoundResponse('No import is running')
      );
    }
    return Promise.resolve(notFoundResponse('Not found'));
  });
}

function renderFlow() {
  return render(
    <MemoryRouter
      initialEntries={['/', '/settings', '/import']}
      initialIndex={2}
    >
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/" element={<p>the browse home</p>} />
          <Route path="/settings" element={<p>the settings hub</p>} />
          <Route path="/import" element={<ImportFlow />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

/** The setup step, its Library folders group landed so Start can be pressed. */
async function setupStep(): Promise<void> {
  await screen.findByRole('textbox', { name: 'Spreadsheet' });
  await screen.findByText('Library folders');
}

const modeGroup = () =>
  screen.findByRole('radiogroup', { name: 'Link or copy' });
const modeRadio = (name: 'Link' | 'Copy') =>
  screen.findByRole('radio', { name: new RegExp(`^${name}`) });

function startRun() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Spreadsheet' }), {
    target: { value: SHEET },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Start import' }));
}

/** The body of the one start the screen sent. */
async function startBody(): Promise<Record<string, unknown>> {
  await waitFor(() => {
    expect(fetchMock.mock.calls.some(([i, n]) => isStart(i, n))).toBe(true);
  });
  const [, init] = fetchMock.mock.calls.find(([i, n]) => isStart(i, n)) ?? [];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

const follows = (first: Node, second: Node) =>
  (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !==
  0;

describe('ImportFlow — the Import mode on setup', () => {
  it('draws the choice above the Also fetch card', async () => {
    serve();
    renderFlow();
    await setupStep();

    const group = await modeGroup();
    const enrich = await screen.findByRole('checkbox', { name: ENRICH_LABEL });
    expect(follows(group, enrich)).toBe(true);
  });

  it('draws the choice under What the scanner accepts', async () => {
    serve();
    renderFlow();
    await setupStep();

    const group = await modeGroup();
    expect(follows(screen.getByText('What the scanner accepts'), group)).toBe(
      true
    );
  });

  it('chooses Link on mount', async () => {
    serve();
    renderFlow();
    await setupStep();

    expect((await modeRadio('Link')).getAttribute('aria-checked')).toBe('true');
    expect((await modeRadio('Copy')).getAttribute('aria-checked')).toBe(
      'false'
    );
  });

  it('posts mode link when nothing is pressed', async () => {
    serve();
    renderFlow();
    await setupStep();
    await modeGroup();

    startRun();

    expect(await startBody()).toEqual({
      sheetPath: SHEET,
      enrich: false,
      mode: 'link',
    });
  });

  it('posts mode copy once Copy is pressed', async () => {
    serve();
    renderFlow();
    await setupStep();

    fireEvent.click(await modeRadio('Copy'));
    expect((await modeRadio('Copy')).getAttribute('aria-checked')).toBe('true');
    startRun();

    expect(await startBody()).toEqual({
      sheetPath: SHEET,
      enrich: false,
      mode: 'copy',
    });
  });

  it('posts the mode beside a ticked Also fetch box', async () => {
    serve();
    renderFlow();
    await setupStep();

    fireEvent.click(await modeRadio('Copy'));
    fireEvent.click(
      await screen.findByRole('checkbox', { name: ENRICH_LABEL })
    );
    startRun();

    expect(await startBody()).toEqual({
      sheetPath: SHEET,
      enrich: true,
      mode: 'copy',
    });
  });

  it('chooses Link again on the next mount — the choice is never remembered', async () => {
    serve();
    const first = renderFlow();
    await setupStep();
    fireEvent.click(await modeRadio('Copy'));
    expect((await modeRadio('Copy')).getAttribute('aria-checked')).toBe('true');
    first.unmount();

    renderFlow();
    await setupStep();

    expect((await modeRadio('Link')).getAttribute('aria-checked')).toBe('true');
  });
});
