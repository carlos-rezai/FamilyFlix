import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';

import { ImportFlow } from './ImportFlow';
import type { ImportRun } from '@/types';
import { theme } from '@/styles/theme';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  createdResponse,
  noContentResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125) and "cancel,
 * re-attach and the already-in-library skip" (issue #126).
 *
 * The **Import flow** organism: the header row from `feat.ImportFlow.dc.html`
 * and one of three steps under it, driven by the **Run hook**. The seam is
 * `fetch` and the router — what the maintainer types, presses and sees, and
 * where the screen lands — never the hook or the steps by themselves.
 *
 * The screen asks for the **Current run** on arrival: a run already going is
 * shown as the running step, and the setup fields are never offered while a
 * run exists — not on arrival, not on a `409`. _Cancel import_ sends the
 * cancel and returns to setup with both fields as typed.
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

/** A 409 — a **Current run** already exists. */
function conflictResponse(): Response {
  return {
    ok: false,
    status: 409,
    json: () => Promise.resolve({ error: 'An import is already running' }),
  } as unknown as Response;
}

const isCurrent = (input: RequestInfo | URL, init?: RequestInit) =>
  String(input).endsWith('/api/import/current') &&
  (init?.method ?? 'GET').toUpperCase() === 'GET';
const isStart = (input: RequestInfo | URL, init?: RequestInit) =>
  String(input).endsWith('/api/import') &&
  init?.method?.toUpperCase() === 'POST';
const isCancel = (input: RequestInfo | URL, init?: RequestInit) =>
  String(input).endsWith('/api/import/current/cancel') &&
  init?.method?.toUpperCase() === 'POST';

/** The reads of the current route so far. */
const reads = () => fetchMock.mock.calls.filter(([i, n]) => isCurrent(i, n));

/**
 * A server with one run at a time. `current` answers `404` until a run
 * exists — from a start that answered `201` (or was refused as `409`, because
 * that is what a `409` means), or from `onArrival` for a run already going
 * when the screen opens — then each read answers the next snapshot in `then`,
 * holding the last for every read after. A cancel answers `204` and the run
 * is gone. `hold`, when given, is awaited before the first read answers, so a
 * test can look at the screen while it does not know yet.
 */
function serve(
  started: Response,
  then: ImportRun[] = [],
  {
    onArrival = false,
    hold,
  }: { onArrival?: boolean; hold?: Promise<void> } = {}
) {
  let read = 0;
  let running = onArrival;
  fetchMock.mockImplementation(async (input, init) => {
    if (isCancel(input, init)) {
      running = false;
      return noContentResponse();
    }
    if (isStart(input, init)) {
      if (started.status === 201 || started.status === 409) {
        running = true;
      }
      return started;
    }
    if (isCurrent(input, init)) {
      if (read === 0 && hold !== undefined) {
        await hold;
      }
      if (!running) {
        return notFoundResponse('No import is running');
      }
      const snapshot = then[Math.min(read, then.length - 1)];
      read += 1;
      return okResponse(snapshot);
    }
    throw new Error(`Unexpected request: ${String(input)}`);
  });
}

/** The settings hub, with the one row that leads into this screen. */
function SettingsStub() {
  const navigate = useNavigate();
  return (
    <>
      <p>the settings hub</p>
      <button type="button" onClick={() => navigate('/import')}>
        Import library
      </button>
    </>
  );
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
          <Route path="/settings" element={<SettingsStub />} />
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

/** The running step is on screen: its headline for the phase. */
const runningStep = (headline = 'Importing movies…') =>
  screen.findByText(headline, undefined, POLLING);

/** The setup step is on screen — the arrival read has answered its 404. */
const setupStep = () => screen.findByRole('textbox', { name: 'Spreadsheet' });

describe('ImportFlow — the header', () => {
  it('renders the heading and the lede the prototype draws', () => {
    serve(createdResponse(makeImportRun()));
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
    serve(createdResponse(makeImportRun()));
    renderFlow();

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(currentPath()).toBe('/settings');
  });
});

describe('ImportFlow — opens on the setup step when there is no run', () => {
  it('shows the two fields and Start import, and nothing of the other steps', async () => {
    serve(createdResponse(makeImportRun()));
    renderFlow();

    expect(await setupStep()).toBeDefined();
    expect(rootField()).toBeDefined();
    expect(startButton()).toBeDefined();
    expect(screen.queryByText('Scanning your library…')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText('✓ All done')).toBeNull();
  });

  it('asks for the current run on arrival, once, and starts nothing', async () => {
    serve(createdResponse(makeImportRun()));
    renderFlow();

    await setupStep();

    expect(reads()).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([i, n]) => isStart(i, n))).toHaveLength(
      0
    );
  });
});

/**
 * Re-attaching: the screen asks for `current` on arrival, so a fresh mount
 * with a run already going — arriving mid-run, a reload, or leaving and
 * coming back — is the running step. The setup fields are never offered
 * while a run exists, which includes the moment before the answer arrives.
 */
describe('ImportFlow — a run already in progress', () => {
  it('shows the running step on arrival, and never the setup fields first', async () => {
    let answer: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      answer = resolve;
    });
    serve(
      createdResponse(makeImportRun()),
      [makeImportRun({ phase: 'importing', total: 4, done: 2, matched: 4 })],
      { onArrival: true, hold }
    );
    renderFlow();

    // Not known yet: neither step is offered.
    expect(screen.queryByRole('textbox', { name: 'Spreadsheet' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start import' })).toBeNull();
    expect(screen.queryByText('Importing movies…')).toBeNull();

    answer();

    expect(await runningStep()).toBeDefined();
    expect(screen.getByText('2 of 4 imported')).toBeDefined();
    expect(screen.getByRole('progressbar')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel import' })).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Spreadsheet' })).toBeNull();
  });

  it('shows a run arriving mid-scan as the scanning step', async () => {
    serve(
      createdResponse(makeImportRun()),
      [makeImportRun({ phase: 'scanning', found: 7 })],
      { onArrival: true }
    );
    renderFlow();

    expect(await runningStep('Scanning your library…')).toBeDefined();
    expect(screen.getByText('Found 7 movies so far')).toBeDefined();
  });

  it('shows a run already in review as the review step', async () => {
    serve(
      createdResponse(makeImportRun()),
      [
        makeImportRun({
          phase: 'review',
          found: 2,
          total: 2,
          done: 2,
          matched: 2,
        }),
      ],
      { onArrival: true }
    );
    renderFlow();

    expect(await screen.findByText('✓ All done')).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Spreadsheet' })).toBeNull();
  });

  it('keeps refreshing the re-attached run from each poll', async () => {
    serve(
      createdResponse(makeImportRun()),
      [
        makeImportRun({ phase: 'importing', total: 4, done: 2, matched: 4 }),
        makeImportRun({ phase: 'importing', total: 4, done: 3, matched: 4 }),
      ],
      { onArrival: true }
    );
    renderFlow();

    expect(await runningStep()).toBeDefined();
    expect(
      await screen.findByText('3 of 4 imported', undefined, POLLING)
    ).toBeDefined();
  });

  it('shows the running step again after leaving for Settings and coming back', async () => {
    serve(createdResponse(makeImportRun({ phase: 'scanning' })), [
      makeImportRun({ phase: 'importing', total: 2, done: 1, matched: 2 }),
    ]);
    renderFlow();
    await setupStep();
    startRun();
    await runningStep();

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText('the settings hub')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Import library' }));

    expect(currentPath()).toBe('/import');
    expect(await runningStep()).toBeDefined();
    expect(screen.getByText('1 of 2 imported')).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Spreadsheet' })).toBeNull();
  });
});

describe('ImportFlow — starting the run', () => {
  it('posts the two paths and shows the running step', async () => {
    serve(createdResponse(makeImportRun({ phase: 'scanning', found: 0 })), [
      makeImportRun({ phase: 'scanning', found: 1 }),
    ]);
    renderFlow();
    await setupStep();

    startRun();

    expect(await screen.findByText('Scanning your library…')).toBeDefined();
    const [input, init] =
      fetchMock.mock.calls.find(([i, n]) => isStart(i, n)) ?? [];
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
    await setupStep();

    startRun();

    expect(await screen.findByText('Scanning your library…')).toBeDefined();
    expect(
      await screen.findByText('Importing movies…', undefined, POLLING)
    ).toBeDefined();
    expect(screen.getByText('1 of 2 imported')).toBeDefined();
  });
});

describe('ImportFlow — a 409 on Start', () => {
  it('shows the run already in progress, not the setup fields', async () => {
    serve(conflictResponse(), [
      makeImportRun({
        id: 'run-elsewhere',
        phase: 'importing',
        total: 3,
        done: 1,
        matched: 3,
      }),
    ]);
    renderFlow();
    await setupStep();

    startRun();

    expect(await runningStep()).toBeDefined();
    expect(screen.getByText('1 of 3 imported')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel import' })).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Spreadsheet' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start import' })).toBeNull();
  });

  it('draws no reason under either field', async () => {
    serve(conflictResponse(), [
      makeImportRun({ phase: 'importing', total: 3, done: 1, matched: 3 }),
    ]);
    renderFlow();
    await setupStep();

    startRun();
    await runningStep();

    expect(screen.queryByText(/could not be found/)).toBeNull();
    expect(screen.queryByText(/already running/)).toBeNull();
  });
});

/**
 * _Cancel import_: the cancel is sent, and the screen is back on the setup
 * step with both fields holding what was typed — the maintainer pressed
 * Cancel to fix something, not to start over.
 */
describe('ImportFlow — Cancel import', () => {
  it('sends the cancel and returns to setup with both fields as typed', async () => {
    serve(createdResponse(makeImportRun({ phase: 'scanning' })), [
      makeImportRun({ phase: 'importing', total: 2, done: 1, matched: 2 }),
    ]);
    renderFlow();
    await setupStep();
    startRun();
    await runningStep();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel import' }));

    expect(await setupStep()).toBeDefined();
    expect(
      fetchMock.mock.calls.filter(([i, n]) => isCancel(i, n))
    ).toHaveLength(1);
    expect(sheetField().value).toBe(SHEET);
    expect(rootField().value).toBe(ROOT);
    expect(startButton()).toBeDefined();
    expect(screen.queryByText('Importing movies…')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel import' })).toBeNull();
  });

  it('stays on setup — the cancelled run does not come back on a later poll', async () => {
    serve(createdResponse(makeImportRun({ phase: 'scanning' })), [
      makeImportRun({ phase: 'importing', total: 2, done: 1, matched: 2 }),
    ]);
    renderFlow();
    await setupStep();
    startRun();
    await runningStep();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel import' }));
    await setupStep();
    const settled = reads().length;
    await new Promise((resolve) => setTimeout(resolve, 1200));

    expect(reads()).toHaveLength(settled);
    expect(sheetField().value).toBe(SHEET);
    expect(screen.queryByText('Importing movies…')).toBeNull();
  });

  it('can start again from the fields it kept', async () => {
    serve(createdResponse(makeImportRun({ phase: 'scanning' })), [
      makeImportRun({ phase: 'importing', total: 2, done: 1, matched: 2 }),
    ]);
    renderFlow();
    await setupStep();
    startRun();
    await runningStep();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel import' }));
    await setupStep();

    fireEvent.click(startButton());

    expect(await screen.findByText('Scanning your library…')).toBeDefined();
    const starts = fetchMock.mock.calls.filter(([i, n]) => isStart(i, n));
    expect(starts).toHaveLength(2);
    expect(JSON.parse(String(starts[1][1]?.body))).toEqual({
      sheetPath: SHEET,
      rootPath: ROOT,
    });
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
    await setupStep();

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
    await setupStep();

    startRun();

    const line = await screen.findByText('That folder could not be found.');
    expect(comesBefore(rootField(), line)).toBe(true);
    expect(comesBefore(line, startButton())).toBe(true);
  });

  it('keeps both values as typed', async () => {
    serve(refusedResponse('sheet', 'That spreadsheet could not be found.'));
    renderFlow();
    await setupStep();

    startRun();

    await screen.findByText('That spreadsheet could not be found.');
    expect(sheetField().value).toBe(SHEET);
    expect(rootField().value).toBe(ROOT);
  });

  it('clears the line when the refused field is edited', async () => {
    serve(refusedResponse('sheet', 'That spreadsheet could not be found.'));
    renderFlow();
    await setupStep();
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
    await setupStep();
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
    await setupStep();
    startRun();
    await screen.findByText('That folder could not be found.');

    fireEvent.change(rootField(), { target: { value: 'D:\\Films' } });

    expect(screen.queryByText('That folder could not be found.')).toBeNull();
  });

  it('polls nothing after a refusal — no run exists', async () => {
    serve(refusedResponse('sheet', 'That spreadsheet could not be found.'));
    renderFlow();
    await setupStep();
    startRun();
    await screen.findByText('That spreadsheet could not be found.');
    const settled = reads().length;

    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(reads()).toHaveLength(settled);
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
    await setupStep();

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
    await setupStep();
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
