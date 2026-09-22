import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';

import { ImportFlow } from './ImportFlow';
import type { ImportProblem, ImportRun } from '@/types';
import { theme } from '@/styles/theme';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import {
  LocationProbe,
  navigationType,
} from '@/test-support/LocationProbe/LocationProbe';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  createdResponse,
  noContentResponse,
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125), "cancel,
 * re-attach and the already-in-library skip" (issue #126), and Phase 4:
 * "problems and review" (issue #129) — the **Review step** with its tiles and
 * its **Needs attention** list: _Skip_ sends the `DELETE`, the row goes and
 * the tile counts down, on a `404` just the same; _Resolve_ lands on the form
 * in import context; `✓ All done` once the last row is gone. Phase 7 (issue
 * #133) adds the poll that fails: the running step stays, showing the last
 * snapshot, until a poll answers again.
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
const isDismiss = (input: RequestInfo | URL, init?: RequestInit) =>
  /\/api\/import\/current\/problems\/[^/]+$/.test(String(input)) &&
  init?.method?.toUpperCase() === 'DELETE';

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
    dismiss = () => noContentResponse(),
  }: {
    onArrival?: boolean;
    hold?: Promise<void>;
    /** What a `DELETE` of a problem answers — `204` unless a test says. */
    dismiss?: () => Response;
  } = {}
) {
  let read = 0;
  let running = onArrival;
  fetchMock.mockImplementation(async (input, init) => {
    if (isCancel(input, init)) {
      running = false;
      return noContentResponse();
    }
    if (isDismiss(input, init)) {
      return dismiss();
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

/**
 * The settings hub, with the one row that leads into this screen — and a Back
 * of its own on the app's one rule, because a journey out of Import is two
 * presses and the second one is the hub's. Only one route renders at a time,
 * so this pill and Import's never answer the same query.
 */
function SettingsStub() {
  const navigate = useNavigate();
  const goBack = useGoBack();
  return (
    <>
      <p>the settings hub</p>
      <button type="button" onClick={() => navigate('/import')}>
        Import library
      </button>
      <button type="button" onClick={goBack}>
        Back
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
          <Route path="/add" element={<p>the add form</p>} />
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

/** The problems a review arrives with, in these tests. */
const PROBLEMS: ImportProblem[] = [
  {
    id: 'p1',
    kind: 'no-row',
    title: 'Ironwood (2018)',
    reason: "Folder isn't in the spreadsheet.",
  },
  {
    id: 'p2',
    kind: 'no-folder',
    title: 'The Lantern Keeper',
    reason: 'No folder found matching this spreadsheet row.',
  },
];

/** A run already in review with `problems`, for the screen to attach to. */
const reviewOf = (problems: ImportProblem[], matched = 2): ImportRun =>
  makeImportRun({
    phase: 'review',
    found: 4,
    total: matched,
    done: matched,
    matched,
    problems,
  });

/** A tile is its label's parent; the number is the one other thing in it. */
const tileNumber = (label: RegExp): string =>
  within(screen.getByText(label).parentElement as HTMLElement).getByText(
    /^[\d,]+$/
  ).textContent ?? '';

const ATTENTION = /need your\s*attention/;
const MATCHED = /matched confidently\s*and imported/;

/** The row a problem's title is in: the text block's parent. */
const rowOf = (title: string): HTMLElement =>
  screen.getByText(title).parentElement?.parentElement as HTMLElement;

/** The DELETEs sent so far, by url. */
const dismissals = () =>
  fetchMock.mock.calls
    .filter(([input, init]) => isDismiss(input, init))
    .map(([input]) => String(input));

/** Arrive on a run already in review, and wait for its list. */
async function arriveInReview(
  problems: ImportProblem[] = PROBLEMS,
  options: { dismiss?: () => Response } = {}
) {
  serve(createdResponse(reviewOf(problems)), [reviewOf(problems)], {
    onArrival: true,
    ...options,
  });
  renderFlow();
  await screen.findByText(ATTENTION);
}

describe('ImportFlow — the review of problems', () => {
  it('shows the two tiles and the list once the polling sees the run in review', async () => {
    serve(createdResponse(makeImportRun({ phase: 'scanning' })), [
      makeImportRun({ phase: 'importing', total: 2, done: 1, matched: 2 }),
      reviewOf(PROBLEMS),
    ]);
    renderFlow();
    await setupStep();

    startRun();

    expect(
      await screen.findByText(ATTENTION, undefined, POLLING)
    ).toBeDefined();
    expect(tileNumber(MATCHED)).toBe('2');
    expect(tileNumber(ATTENTION)).toBe('2');
    expect(screen.getByText('Needs attention')).toBeDefined();
    expect(screen.getByText('Ironwood (2018)')).toBeDefined();
    expect(screen.getByText('The Lantern Keeper')).toBeDefined();
    expect(screen.queryByText('✓ All done')).toBeNull();
    expect(screen.queryByText('Importing movies…')).toBeNull();
  });

  it('sends the DELETE on Skip, drops the row and counts the tile down', async () => {
    await arriveInReview();

    fireEvent.click(
      within(rowOf('The Lantern Keeper')).getByRole('button', { name: 'Skip' })
    );

    await waitFor(() =>
      expect(screen.queryByText('The Lantern Keeper')).toBeNull()
    );
    expect(dismissals()).toEqual(['/api/import/current/problems/p2']);
    expect(screen.getByText('Ironwood (2018)')).toBeDefined();
    expect(tileNumber(ATTENTION)).toBe('1');
    expect(tileNumber(MATCHED)).toBe('2');
  });

  it('imports nothing for a Skip', async () => {
    await arriveInReview();

    fireEvent.click(
      within(rowOf('The Lantern Keeper')).getByRole('button', { name: 'Skip' })
    );
    await waitFor(() =>
      expect(screen.queryByText('The Lantern Keeper')).toBeNull()
    );

    const requests = fetchMock.mock.calls.map(
      ([input, init]) =>
        `${(init?.method ?? 'GET').toUpperCase()} ${String(input)}`
    );
    expect(requests.filter((request) => /\/api\/movies/.test(request))).toEqual(
      []
    );
    expect(requests.filter((request) => request.startsWith('POST'))).toEqual(
      []
    );
  });

  it('drops the row on a 404 just the same — a problem already gone is gone', async () => {
    await arriveInReview(PROBLEMS, {
      dismiss: () => notFoundResponse('No such problem'),
    });

    fireEvent.click(
      within(rowOf('Ironwood (2018)')).getByRole('button', { name: 'Skip' })
    );

    await waitFor(() =>
      expect(screen.queryByText('Ironwood (2018)')).toBeNull()
    );
    expect(dismissals()).toEqual(['/api/import/current/problems/p1']);
    expect(tileNumber(ATTENTION)).toBe('1');
  });

  it('keeps the row when the Skip could not be made', async () => {
    await arriveInReview(PROBLEMS, { dismiss: () => serverErrorResponse() });

    fireEvent.click(
      within(rowOf('Ironwood (2018)')).getByRole('button', { name: 'Skip' })
    );

    await waitFor(() => expect(dismissals()).toHaveLength(1));
    expect(screen.getByText('Ironwood (2018)')).toBeDefined();
    expect(tileNumber(ATTENTION)).toBe('2');
  });

  it('shows All done once the last row is skipped, with Finish still there', async () => {
    await arriveInReview([PROBLEMS[0]]);
    expect(screen.queryByText('✓ All done')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(await screen.findByText('✓ All done')).toBeDefined();
    expect(
      screen.getByText('Every flagged movie has been handled.')
    ).toBeDefined();
    expect(screen.queryByText('Needs attention')).toBeNull();
    expect(tileNumber(ATTENTION)).toBe('0');
    expect(
      screen.getByRole('button', { name: 'Finish — go to library' })
    ).toBeDefined();
  });

  it('lands on the form in import context from Resolve', async () => {
    await arriveInReview();

    fireEvent.click(
      within(rowOf('The Lantern Keeper')).getByRole('link', { name: 'Resolve' })
    );

    expect(screen.getByTestId('url').textContent).toBe('/add?problem=p2');
    expect(screen.getByText('the add form')).toBeDefined();
  });

  it('lands on the browse home from Finish while problems remain', async () => {
    await arriveInReview();

    fireEvent.click(
      screen.getByRole('button', { name: 'Finish — go to library' })
    );

    expect(currentPath()).toBe('/');
    expect(screen.getByText('the browse home')).toBeDefined();
  });

  it('reaches review with zeros and the card for a run over an empty root', async () => {
    serve(createdResponse(makeImportRun({ phase: 'scanning' })), [
      reviewOf([], 0),
    ]);
    renderFlow();
    await setupStep();

    startRun();

    expect(
      await screen.findByText('✓ All done', undefined, POLLING)
    ).toBeDefined();
    expect(tileNumber(MATCHED)).toBe('0');
    expect(tileNumber(ATTENTION)).toBe('0');
    expect(screen.queryByText('Needs attention')).toBeNull();
  });
});

// --- 13 — Bulk import, Phase 7: a poll that fails (issue #133) ----------------

/**
 * Story 100: the server gone for a moment never blanks the console. The
 * running step stays on screen through a poll that answers `500` and one
 * that cannot be made at all, showing the last snapshot it had; the polling
 * goes on; and the first poll that answers again refreshes the step.
 */
describe('ImportFlow — a poll that fails', () => {
  const failNextRead = (answer: () => Promise<Response>) => {
    fetchMock.mockImplementationOnce(answer);
  };

  it('keeps the running step on screen, showing the last snapshot', async () => {
    serve(createdResponse(makeImportRun({ phase: 'scanning', found: 0 })), [
      makeImportRun({ phase: 'importing', total: 4, done: 1, matched: 4 }),
      makeImportRun({ phase: 'importing', total: 4, done: 2, matched: 4 }),
    ]);
    renderFlow();
    await setupStep();
    startRun();
    expect(
      await screen.findByText('1 of 4 imported', undefined, POLLING)
    ).toBeDefined();
    const seen = reads().length;

    failNextRead(() => Promise.resolve(serverErrorResponse()));
    failNextRead(() => Promise.reject(new TypeError('Failed to fetch')));
    await waitFor(
      () => expect(reads().length).toBeGreaterThanOrEqual(seen + 2),
      POLLING
    );

    expect(screen.getByText('Importing movies…')).toBeDefined();
    expect(screen.getByText('1 of 4 imported')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel import' })).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Spreadsheet' })).toBeNull();
  });

  it('refreshes the step from the first poll that answers again', async () => {
    serve(createdResponse(makeImportRun({ phase: 'scanning', found: 0 })), [
      makeImportRun({ phase: 'importing', total: 4, done: 1, matched: 4 }),
      makeImportRun({ phase: 'importing', total: 4, done: 3, matched: 4 }),
    ]);
    renderFlow();
    await setupStep();
    startRun();
    expect(
      await screen.findByText('1 of 4 imported', undefined, POLLING)
    ).toBeDefined();

    failNextRead(() => Promise.reject(new TypeError('Failed to fetch')));

    expect(
      await screen.findByText('3 of 4 imported', undefined, POLLING)
    ).toBeDefined();
    expect(screen.getByText('Importing movies…')).toBeDefined();
  });
});

/**
 * 20 — Back navigation, Phase 3: "the Import steps" (issue #173).
 *
 * Back on Import stops pushing `/settings` and becomes the app's one **Back
 * rule** — a **History step**, with Settings as the **Landing** for an Import
 * nothing opened. _Finish_ is untouched: it stays a push to `/`, the **Fresh
 * home** that puts the films the run just added on their shelves.
 *
 * The header's existing test above landed on `/settings` and was right about
 * it — and would have been right about it whichever way the screen got there.
 * Which is why these tests read `navigationType` and press Back **twice**: the
 * duplicate `/settings` entry the push left behind is only visible on the
 * second press, when the maintainer walks back into Import instead of out to
 * the library.
 *
 * Nothing here goes near the **Run hook**. A Back mid-run leaves the run where
 * it is — it is the server's **Current run**, re-attached on the next visit —
 * so the one thing to assert about it is the request that must *not* be made.
 *
 * That Finish is the one push left is carried by the presses, not by reading
 * the file: Back is a `POP` and a second Back reaches the library, and Finish
 * is a `PUSH` onto `/`. That no file but the hook steps through history at all
 * is the hook suite's guard.
 */
describe('ImportFlow — leaving is a history step', () => {
  /** The cancels sent so far — the run's life, asserted by its absence. */
  const cancels = () => fetchMock.mock.calls.filter(([i, n]) => isCancel(i, n));

  const pressBack = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

  it('steps back onto Settings rather than pushing a second entry for it', () => {
    serve(createdResponse(makeImportRun()));
    renderFlow();

    pressBack();

    expect(currentPath()).toBe('/settings');
    expect(navigationType()).toBe('POP');
  });

  it('lands on the browse home when Back is pressed again, not back on Import', async () => {
    // The journey reproduced in the browser on 2026-09-21: the gear, Import
    // from spreadsheet, Back, Back. The first press was always right, and the
    // second one walked into the duplicate entry the first had left behind.
    serve(createdResponse(makeImportRun()));
    renderFlow(['/', '/settings']);
    fireEvent.click(screen.getByRole('button', { name: 'Import library' }));
    await setupStep();

    pressBack();
    expect(currentPath()).toBe('/settings');

    pressBack();

    expect(currentPath()).toBe('/');
    expect(screen.getByText('the browse home')).toBeDefined();
  });

  it('pushes Settings for an Import opened by deep link, so Settings has a Back of its own', async () => {
    // Nothing behind Import — a reload, or the URL opened cold. The **Landing**
    // is pushed rather than stepped onto, and pushed rather than replaced, so
    // the hub it lands on is not left with a dead button.
    //
    // The one journey the push already got right, and so the one test here that
    // is green before the change: with no history behind it the **Back rule**
    // pushes the landing too, which is the same navigation by accident. It is
    // written as a guard — a step taken here, or a `replace`, would strand the
    // maintainer, and nothing else in this file would notice.
    serve(createdResponse(makeImportRun()));
    renderFlow(['/import']);
    await setupStep();

    pressBack();

    expect(currentPath()).toBe('/settings');
    expect(navigationType()).toBe('PUSH');
  });

  it('leaves a running import exactly where it is, sending no cancel', async () => {
    // Back is not _Cancel import_. The run belongs to the server, and the next
    // visit re-attaches to it — which is why this slice never touches the
    // **Run hook**, and why the assertion is a request that was not made.
    serve(
      createdResponse(makeImportRun({ phase: 'scanning' })),
      [makeImportRun({ phase: 'importing', total: 2, done: 1, matched: 2 })],
      { onArrival: true }
    );
    renderFlow();
    await runningStep();

    pressBack();

    expect(currentPath()).toBe('/settings');
    expect(navigationType()).toBe('POP');
    expect(cancels()).toHaveLength(0);
  });

  it('finds the same run still going on the way back in', async () => {
    // The other half of the same promise: the **Current run** is the server's,
    // so a step out and a fresh push back in draws the running step again,
    // exactly as the push did. `useImportRun` is unedited by this slice and
    // this is what says so from the outside.
    serve(
      createdResponse(makeImportRun({ phase: 'scanning' })),
      [makeImportRun({ phase: 'importing', total: 2, done: 1, matched: 2 })],
      { onArrival: true }
    );
    renderFlow();
    await runningStep();

    pressBack();
    fireEvent.click(screen.getByRole('button', { name: 'Import library' }));

    expect(currentPath()).toBe('/import');
    expect(await runningStep()).toBeDefined();
    expect(screen.getByText('1 of 2 imported')).toBeDefined();
    expect(cancels()).toHaveLength(0);
  });

  it('keeps Finish a push onto a fresh browse home', async () => {
    // The **Fresh home**, untouched: a new entry at the top of an unfiltered
    // library, where the films the run just added are on their shelves. A step
    // here would land on whatever shelf the maintainer left, which is the one
    // thing Finish is not.
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

    expect(currentPath()).toBe('/');
    expect(navigationType()).toBe('PUSH');
  });
});
