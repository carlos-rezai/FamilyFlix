import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ImportFlow } from './ImportFlow';
import type { ImportRun } from '@/types';
import { theme } from '@/styles/theme';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
 *
 * The **Import flow** organism: the header row from `feat.ImportFlow.dc.html`
 * and one of three steps under it, driven by the **Run hook**. The seam is
 * `fetch` and the router — what the maintainer types, presses and sees, and
 * where the screen lands — never the hook or the steps by themselves.
 *
 * Polling is real time here, 500 ms a poll, so a run walked through to the
 * **Review step** takes about a second of wall clock. That is the cost of
 * asserting the review is reached by the screen's own polling and not by a
 * snapshot handed in.
 */

const SHEET = 'C:\\Movies\\library.xlsx';
const ROOT = 'C:\\Movies';

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

/** A 400 naming the field it refuses — the shape `POST /api/import` promises. */
function refusedResponse(field: 'sheet' | 'root', error: string): Response {
  return {
    ok: false,
    status: 400,
    json: () => Promise.resolve({ error, field }),
  } as unknown as Response;
}

/**
 * A server that answers the start with `started` and each poll with the next
 * snapshot in `then`, holding the last for every poll after it.
 */
function serve(started: Response, then: ImportRun[] = []) {
  let poll = 0;
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (url.endsWith('/api/import') && init?.method === 'POST') {
      return Promise.resolve(started);
    }
    if (url.endsWith('/api/import/current')) {
      const snapshot = then[Math.min(poll, then.length - 1)];
      poll += 1;
      return Promise.resolve(okResponse(snapshot));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

/**
 * Import opened from Settings, so Back has somewhere to go — the state the
 * one route into this screen actually creates.
 */
function renderFlow(history: string[] = ['/', '/settings', '/import']) {
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/" element={<p>the browse home</p>} />
          <Route path="/settings" element={<p>the settings hub</p>} />
          <Route path="/import" element={<ImportFlow />} />
        </Routes>
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
}

const sheetField = () =>
  screen.getByRole('textbox', { name: 'Spreadsheet' }) as HTMLInputElement;
const rootField = () =>
  screen.getByRole('textbox', {
    name: 'Movies root folder',
  }) as HTMLInputElement;
const startButton = () => screen.getByRole('button', { name: 'Start import' });
const currentPath = () => screen.getByTestId('pathname').textContent;

/** Type both paths and press Start import. */
function startRun(sheet = SHEET, root = ROOT) {
  fireEvent.change(sheetField(), { target: { value: sheet } });
  fireEvent.change(rootField(), { target: { value: root } });
  fireEvent.click(startButton());
}

/** Long enough for two polls at 500 ms, with room. */
const POLLING = { timeout: 3000 };

describe('ImportFlow — the header', () => {
  it('renders the heading and the lede the prototype draws', () => {
    renderFlow();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Import library' })
    ).toBeDefined();
    expect(
      screen.getByText(
        'Bulk-migrate your spreadsheet and movie folders in one pass.'
      )
    ).toBeDefined();
  });

  it('returns to Settings from Back', () => {
    renderFlow();

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(currentPath()).toBe('/settings');
  });
});

describe('ImportFlow — opens on the setup step', () => {
  it('shows the two fields and Start import, and nothing of the other steps', () => {
    renderFlow();

    expect(sheetField()).toBeDefined();
    expect(rootField()).toBeDefined();
    expect(startButton()).toBeDefined();
    expect(screen.queryByText('Scanning your library…')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText('✓ All done')).toBeNull();
  });

  it('makes no request on arrival', () => {
    renderFlow();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('ImportFlow — starting the run', () => {
  it('posts the two paths and shows the running step', async () => {
    serve(createdResponse(makeImportRun({ phase: 'scanning', found: 0 })), [
      makeImportRun({ phase: 'scanning', found: 1 }),
    ]);
    renderFlow();

    startRun();

    expect(await screen.findByText('Scanning your library…')).toBeDefined();
    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toBe('/api/import');
    expect(JSON.parse(String(init?.body))).toEqual({
      sheetPath: SHEET,
      rootPath: ROOT,
    });
    // The setup step is gone; the running step's bar and Cancel are here.
    expect(screen.queryByRole('textbox', { name: 'Spreadsheet' })).toBeNull();
    expect(screen.getByRole('progressbar')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel import' })).toBeDefined();
  });

  it('refreshes the running step from each poll', async () => {
    serve(createdResponse(makeImportRun({ phase: 'scanning', found: 0 })), [
      makeImportRun({ phase: 'importing', total: 2, done: 1, matched: 2 }),
    ]);
    renderFlow();

    startRun();

    expect(await screen.findByText('Scanning your library…')).toBeDefined();
    expect(
      await screen.findByText('Importing movies…', undefined, POLLING)
    ).toBeDefined();
    expect(screen.getByText('1 of 2 imported')).toBeDefined();
  });
});

/**
 * The refusal is drawn where it belongs — under the field the 400 names —
 * and the screen stays on the setup step with both values as typed. The line
 * clears when that field is edited; a corrected root leaves a refused sheet's
 * line standing, because nothing about the sheet has changed.
 */
describe('ImportFlow — a refused start', () => {
  it('draws the sheet’s reason under the spreadsheet field and stays on setup', async () => {
    serve(refusedResponse('sheet', 'That spreadsheet could not be found.'));
    renderFlow();

    startRun();

    const line = await screen.findByText(
      'That spreadsheet could not be found.'
    );
    expect(comesBefore(sheetField(), line)).toBe(true);
    expect(comesBefore(line, rootField())).toBe(true);
    expect(getComputedStyle(line).fontSize).toBe('13px');
    expect(getComputedStyle(line).color).toBe('rgb(201, 122, 106)');
    expect(screen.queryByText('Scanning your library…')).toBeNull();
  });

  it('draws the root’s reason under the root field', async () => {
    serve(refusedResponse('root', 'That folder could not be found.'));
    renderFlow();

    startRun();

    const line = await screen.findByText('That folder could not be found.');
    expect(comesBefore(rootField(), line)).toBe(true);
    expect(comesBefore(line, startButton())).toBe(true);
  });

  it('keeps both values as typed', async () => {
    serve(refusedResponse('sheet', 'That spreadsheet could not be found.'));
    renderFlow();

    startRun();

    await screen.findByText('That spreadsheet could not be found.');
    expect(sheetField().value).toBe(SHEET);
    expect(rootField().value).toBe(ROOT);
  });

  it('clears the line when the refused field is edited', async () => {
    serve(refusedResponse('sheet', 'That spreadsheet could not be found.'));
    renderFlow();
    startRun();
    await screen.findByText('That spreadsheet could not be found.');

    fireEvent.change(sheetField(), {
      target: { value: 'C:\\Movies\\library.csv' },
    });

    expect(
      screen.queryByText('That spreadsheet could not be found.')
    ).toBeNull();
    expect(sheetField().value).toBe('C:\\Movies\\library.csv');
    expect(rootField().value).toBe(ROOT);
  });

  it('leaves the line standing when the other field is edited', async () => {
    serve(refusedResponse('sheet', 'That spreadsheet could not be found.'));
    renderFlow();
    startRun();
    await screen.findByText('That spreadsheet could not be found.');

    fireEvent.change(rootField(), { target: { value: 'D:\\Films' } });

    expect(
      screen.getByText('That spreadsheet could not be found.')
    ).toBeDefined();
  });

  it('clears the root’s line when the root is edited', async () => {
    serve(refusedResponse('root', 'That folder could not be found.'));
    renderFlow();
    startRun();
    await screen.findByText('That folder could not be found.');

    fireEvent.change(rootField(), { target: { value: 'D:\\Films' } });

    expect(screen.queryByText('That folder could not be found.')).toBeNull();
  });

  it('polls nothing after a refusal — no run exists', async () => {
    serve(refusedResponse('sheet', 'That spreadsheet could not be found.'));
    renderFlow();
    startRun();
    await screen.findByText('That spreadsheet could not be found.');

    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith('/api/import/current')
      )
    ).toHaveLength(0);
  });
});

describe('ImportFlow — reaching review', () => {
  it('shows All done once the polling sees the run in review', async () => {
    serve(createdResponse(makeImportRun({ phase: 'scanning' })), [
      makeImportRun({ phase: 'importing', total: 2, done: 1, matched: 2 }),
      makeImportRun({
        phase: 'review',
        found: 2,
        total: 2,
        done: 2,
        matched: 2,
      }),
    ]);
    renderFlow();

    startRun();

    expect(
      await screen.findByText('✓ All done', undefined, POLLING)
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Finish — go to library' })
    ).toBeDefined();
    expect(screen.queryByText('Importing movies…')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel import' })).toBeNull();
  });

  it('lands on the browse home from Finish', async () => {
    serve(createdResponse(makeImportRun({ phase: 'scanning' })), [
      makeImportRun({
        phase: 'review',
        found: 2,
        total: 2,
        done: 2,
        matched: 2,
      }),
    ]);
    renderFlow();
    startRun();
    await screen.findByText('✓ All done', undefined, POLLING);

    fireEvent.click(
      screen.getByRole('button', { name: 'Finish — go to library' })
    );

    // A navigation to `/`, not a history step: the films are on the shelf and
    // the home is where the maintainer sees that it worked.
    expect(currentPath()).toBe('/');
    expect(screen.getByText('the browse home')).toBeDefined();
  });
});
