import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ImportFlow } from './ImportFlow';
import type { ImportRun } from '@/types';
import { theme } from '@/styles/theme';
import {
  createdResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import { makeLibraryFolder } from '@/test-support/makeLibraryFolder/makeLibraryFolder';

/**
 * 69, Silent waits, Phase 5 (issue #657): _Start import_ as a Busy button.
 *
 * Disabled while its form is unfilled, as today. Once pressed, with
 * `POST /api/import` held open, it locks at once, so a second press sends
 * nothing, and reads _Starting…_ past 300ms. The move from the **Setup step**
 * to the running one waits out the hold; a refusal puts the button back,
 * pressable, with its sentence under its field, also after the hold.
 *
 * The setup is drawn on real timers; the clock is faked from the press on.
 */

const SHEET = 'C:\\Movies\\library.xlsx';
const REFUSAL = 'That spreadsheet could not be found.';
const STARTED = makeImportRun({ id: 'started' });

const pathOf = (url: string) => new URL(url, 'http://localhost').pathname;
const verbOf = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const isStart = (url: string, init?: RequestInit) =>
  pathOf(url) === '/api/import' && verbOf(init) === 'POST';

/** What `GET /api/import/current` answers; `null` is a `404`. */
let current: ImportRun | null = null;

/** Every read answered at once; only a start is held open. */
const { fetchMock, respond } = heldFetch((url, init) => {
  const p = pathOf(url);
  if (isStart(url, init)) return undefined;
  if (p === '/api/import/current') {
    return current === null
      ? notFoundResponse('No import is running')
      : okResponse(current);
  }
  if (p === '/api/library-folders') {
    return okResponse([
      makeLibraryFolder({ id: 'f-movies', path: 'E:\\Movies', titleCount: 12 }),
    ]);
  }
  if (p === '/api/tmdb/key') return okResponse({ key: null });
  return notFoundResponse('Not found');
});

afterEach(() => {
  current = null;
  vi.useRealTimers();
});

const starts = () =>
  fetchMock.mock.calls.filter(([input, init]) => isStart(String(input), init));

/** A 400 naming the field it refuses, as `POST /api/import` sends it. */
function refusedResponse(field: 'sheet' | 'folders', error: string): Response {
  return {
    ok: false,
    status: 400,
    json: () => Promise.resolve({ error, field }),
  } as unknown as Response;
}

const button = (name: string) =>
  screen.getByRole('button', { name }) as HTMLButtonElement;

const sheetField = () =>
  screen.getByRole('textbox', { name: 'Spreadsheet' }) as HTMLInputElement;

/** _Start import_ locked and busy. */
function expectLocked(face: HTMLButtonElement) {
  expect(face.getAttribute('aria-busy')).toBe('true');
  expect(face.disabled).toBe(true);
}

/** The Setup step drawn, its Library folders landed, on real timers. */
async function setup() {
  render(
    <MemoryRouter initialEntries={['/settings', '/import']} initialIndex={1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/settings" element={<p>the settings hub</p>} />
          <Route path="/import" element={<ImportFlow />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
  await screen.findByRole('textbox', { name: 'Spreadsheet' });
  await screen.findByText('E:\\Movies');
}

/** The sheet typed, the clock faked, _Start import_ pressed. */
function startPressed() {
  fireEvent.change(sheetField(), { target: { value: SHEET } });
  vi.useFakeTimers();
  fireEvent.click(button('Start import'));
}

describe('ImportFlow: Start import as a Busy button', () => {
  it('is disabled while unfilled, and once filled locks at once on a press', async () => {
    await setup();

    expect(button('Start import').disabled).toBe(true);
    fireEvent.click(button('Start import'));
    expect(starts()).toHaveLength(0);

    startPressed();
    expect(starts()).toHaveLength(1);
    expectLocked(button('Start import'));

    fireEvent.click(button('Start import'));
    await advanceClock(0);
    expect(starts()).toHaveLength(1);

    current = STARTED;
    await respond(createdResponse(STARTED));
    await advanceClock(500);
  });

  it('reads Starting… past 300ms', async () => {
    await setup();
    startPressed();

    await advanceClock(299);
    expect(screen.queryByRole('button', { name: 'Starting…' })).toBeNull();
    await advanceClock(1);
    expectLocked(button('Starting…'));

    current = STARTED;
    await respond(createdResponse(STARTED));
    await advanceClock(500);
  });
});

describe('ImportFlow: the move on from a held Start import', () => {
  it('waits out the hold before the running step is drawn', async () => {
    await setup();
    startPressed();

    // Shown at 300; the run lands at 400; the hold runs to 800.
    await advanceClock(400);
    current = STARTED;
    await respond(createdResponse(STARTED));

    await advanceClock(399);
    expectLocked(button('Starting…'));
    expect(screen.queryByRole('button', { name: 'Cancel import' })).toBeNull();

    await advanceClock(1);
    expect(screen.queryByRole('textbox', { name: 'Spreadsheet' })).toBeNull();
    expect(button('Cancel import')).toBeDefined();
    expect(starts()).toHaveLength(1);
  });
});

describe('ImportFlow: a refused Start import', () => {
  it('puts the button back, pressable, with its sentence under its field once the hold is out', async () => {
    await setup();
    startPressed();

    await advanceClock(400);
    await respond(refusedResponse('sheet', REFUSAL));

    await advanceClock(399);
    expectLocked(button('Starting…'));
    expect(screen.queryByText(REFUSAL)).toBeNull();

    await advanceClock(1);
    const face = button('Start import');
    expect(face.getAttribute('aria-busy')).toBeNull();
    expect(face.disabled).toBe(false);
    expect(screen.getByText(REFUSAL)).toBeDefined();

    fireEvent.click(face);
    expect(starts()).toHaveLength(2);
  });
});
