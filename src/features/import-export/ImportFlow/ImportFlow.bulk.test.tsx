import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ImportFlow } from './ImportFlow';
import type { ImportProblem, ImportRun } from '@/types';
import { theme } from '@/styles/theme';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';

/**
 * 41 — Review at scale, Phase 6: "Skip all and Keep all mine in the Import
 * review" (issue #360).
 *
 * The three bulk presses through the whole flow: each posts
 * `POST /api/import/current/problems/dismiss` with the ids it dismisses, and
 * the review redraws from the route's echo — the whole snapshot, so a count
 * the old run never had shows it was the echo that was drawn. No confirm, and
 * no per-row `DELETE`. The seam is `fetch`, as `ImportFlow.test.tsx`'s.
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

const isBulkDismiss = (input: RequestInfo | URL, init?: RequestInit) =>
  String(input).endsWith('/api/import/current/problems/dismiss') &&
  init?.method?.toUpperCase() === 'POST';
const isCurrent = (input: RequestInfo | URL, init?: RequestInit) =>
  String(input).endsWith('/api/import/current') &&
  (init?.method ?? 'GET').toUpperCase() === 'GET';
const isRowDismiss = (_input: RequestInfo | URL, init?: RequestInit) =>
  init?.method?.toUpperCase() === 'DELETE';

const problem = (
  id: string,
  kind: ImportProblem['kind'],
  title = `Title ${id}`
): ImportProblem => ({ id, kind, title, reason: `Reason ${id}.` });

const differs = (id: string, title: string): ImportProblem => ({
  ...problem(id, 'differs', title),
  movieId: `m-${id}`,
  differences: [
    { field: 'director', label: 'Director', mine: 'Mine', sheet: 'Sheet' },
  ],
});

const PROBLEMS: ImportProblem[] = [
  problem('f1', 'no-folder', 'The Night Ferry'),
  problem('l1', 'no-row', 'Ironwood (2018)'),
  problem('f2', 'no-row', 'The Night Ferry'),
  differs('d1', 'Die Hard'),
  differs('d2', 'Heat'),
];

const reviewOf = (problems: ImportProblem[], matched = 2): ImportRun =>
  makeImportRun({
    phase: 'review',
    found: 9,
    total: matched,
    done: matched,
    matched,
    problems,
  });

/** Arrive on a run in review; the bulk dismiss answers with `echo`. */
async function arriveInReview(echo: ImportRun) {
  fetchMock.mockImplementation(async (input, init) => {
    if (isBulkDismiss(input, init)) {
      return okResponse(echo);
    }
    if (isCurrent(input, init)) {
      return okResponse(reviewOf(PROBLEMS));
    }
    if (String(input).endsWith('/api/library-folders')) {
      return okResponse([]);
    }
    if (String(input).endsWith('/api/tmdb/key')) {
      return okResponse({ key: null });
    }
    throw new Error(`Unexpected request: ${String(input)}`);
  });
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
  await screen.findByText('Needs attention');
}

/** The ids each bulk dismiss posted, in order. */
const posted = (): unknown[] =>
  fetchMock.mock.calls
    .filter(([input, init]) => isBulkDismiss(input, init))
    .map(([, init]) => JSON.parse(String(init?.body)));

const tileNumber = (label: RegExp): string =>
  within(screen.getByText(label).parentElement as HTMLElement).getByText(
    /^[\d,]+$/
  ).textContent ?? '';
const MATCHED = /matched confidently\s*and imported/;

const filter = () =>
  screen.getByRole('group', { name: 'Problem kinds' }) as HTMLElement;
const besideFilter = () => filter().parentElement?.parentElement as HTMLElement;

describe('ImportFlow — Skip all on a Review group', () => {
  it('posts the title’s ids and redraws from the echo', async () => {
    const echo = reviewOf(
      PROBLEMS.filter((p) => p.title !== 'The Night Ferry'),
      7
    );
    await arriveInReview(echo);

    fireEvent.click(
      screen.getByRole('button', { name: 'Skip all for The Night Ferry' })
    );

    await waitFor(() =>
      expect(screen.queryByText('The Night Ferry')).toBeNull()
    );
    expect(posted()).toEqual([{ ids: ['f1', 'f2'] }]);
    expect(tileNumber(MATCHED)).toBe('7');
    expect(screen.getByText('Ironwood (2018)')).toBeDefined();
    expect(fetchMock.mock.calls.filter(([i, n]) => isRowDismiss(i, n))).toEqual(
      []
    );
  });
});

describe('ImportFlow — Skip all beside a chosen kind', () => {
  it('posts the kind’s ids and redraws from the echo', async () => {
    const echo = reviewOf(
      PROBLEMS.filter((p) => p.kind !== 'no-row'),
      6
    );
    await arriveInReview(echo);

    fireEvent.click(
      within(filter()).getByRole('button', { name: 'Not in sheet 2' })
    );
    fireEvent.click(
      within(besideFilter()).getByRole('button', { name: 'Skip all' })
    );

    await waitFor(() => expect(tileNumber(MATCHED)).toBe('6'));
    expect(posted()).toEqual([{ ids: ['l1', 'f2'] }]);
    expect(screen.queryByText('Reason l1.')).toBeNull();
    expect(screen.queryByText('Reason f2.')).toBeNull();
  });
});

describe('ImportFlow — Keep all mine beside differs', () => {
  it('posts the differs ids to the same dismiss and redraws from the echo', async () => {
    const echo = reviewOf(
      PROBLEMS.filter((p) => p.kind !== 'differs'),
      5
    );
    await arriveInReview(echo);

    fireEvent.click(
      within(filter()).getByRole('button', { name: 'Differs 2' })
    );
    fireEvent.click(
      within(besideFilter()).getByRole('button', { name: 'Keep all mine' })
    );

    await waitFor(() => expect(tileNumber(MATCHED)).toBe('5'));
    expect(posted()).toEqual([{ ids: ['d1', 'd2'] }]);
    expect(screen.queryByText('Die Hard')).toBeNull();
    expect(screen.queryByText('Heat')).toBeNull();
  });
});
