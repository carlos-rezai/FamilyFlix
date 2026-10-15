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
 * 41 — Review at scale, Phase 6: "Import all as guessed" (issue #361).
 *
 * _Import all as guessed_ beside a chosen `no-row`, through the whole flow:
 * it posts `POST /api/import/current/problems/import-guessed` with the
 * visible ids, and the review redraws from the route's echo — the whole
 * snapshot, a row that could not be settled redrawn in it as its new problem,
 * and a count the old run never had to show it was the echo that was drawn.
 * No confirm, no per-row _Import as_, no dismiss. The seam is `fetch`, as
 * `ImportFlow.bulk.test.tsx`'s.
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

const isImportGuessed = (input: RequestInfo | URL, init?: RequestInit) =>
  String(input).endsWith('/api/import/current/problems/import-guessed') &&
  init?.method?.toUpperCase() === 'POST';
const isBulkDismiss = (input: RequestInfo | URL, init?: RequestInit) =>
  String(input).endsWith('/api/import/current/problems/dismiss') &&
  init?.method?.toUpperCase() === 'POST';
const isRowImport = (input: RequestInfo | URL, init?: RequestInit) =>
  /\/problems\/[^/]+\/import$/.test(String(input)) &&
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

/** Arrive on a run in review; import-guessed answers with `echo`. */
async function arriveInReview(echo: ImportRun) {
  fetchMock.mockImplementation(async (input, init) => {
    if (isImportGuessed(input, init)) {
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

/** The ids each import-guessed posted, in order. */
const posted = (): unknown[] =>
  fetchMock.mock.calls
    .filter(([input, init]) => isImportGuessed(input, init))
    .map(([, init]) => JSON.parse(String(init?.body)));

const tileNumber = (label: RegExp): string =>
  within(screen.getByText(label).parentElement as HTMLElement).getByText(
    /^[\d,]+$/
  ).textContent ?? '';
const MATCHED = /matched confidently\s*and imported/;

const filter = () =>
  screen.getByRole('group', { name: 'Problem kinds' }) as HTMLElement;
const besideFilter = () => filter().parentElement?.parentElement as HTMLElement;

describe('ImportFlow — Import all as guessed beside no-row', () => {
  it('posts the visible no-row ids and redraws from the echo, a redrawn row kept', async () => {
    const echo = reviewOf(
      [
        PROBLEMS[0],
        problem('n1', 'no-video', 'The Night Ferry'),
        PROBLEMS[3],
        PROBLEMS[4],
      ],
      6
    );
    await arriveInReview(echo);

    fireEvent.click(
      within(filter()).getByRole('button', { name: 'Not in sheet 2' })
    );
    fireEvent.click(
      within(besideFilter()).getByRole('button', {
        name: 'Import all as guessed',
      })
    );

    await waitFor(() => expect(tileNumber(MATCHED)).toBe('6'));
    expect(posted()).toEqual([{ ids: ['l1', 'f2'] }]);
    expect(screen.queryByText('Reason l1.')).toBeNull();
    expect(screen.queryByText('Ironwood (2018)')).toBeNull();
    expect(screen.getByText('The Night Ferry')).toBeDefined();
    expect(
      fetchMock.mock.calls.filter(
        ([i, n]) =>
          isRowImport(i, n) || isBulkDismiss(i, n) || isRowDismiss(i, n)
      )
    ).toEqual([]);
  });
});
