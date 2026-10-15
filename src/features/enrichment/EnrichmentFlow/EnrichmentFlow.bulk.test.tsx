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

import { EnrichmentFlow } from './EnrichmentFlow';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import type { Decision, EnrichmentRun, EnrichmentSummary } from '@/types';
import { theme } from '@/styles/theme';
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
import {
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 41 — Review at scale, Phase 6: "Skip all in the Sync review" (issue #362).
 *
 * _Skip all_ through the whole flow: with a kind chosen on the **Kind
 * filter**, the press posts `POST /api/enrichment/current/decisions/dismiss`
 * with the ids of the Decisions shown, and the review redraws from the
 * route's echo — the whole snapshot, so a count the old run never had shows
 * it was the echo that was drawn. No confirm, and no per-row `DELETE`. The
 * seam is `fetch`, as `EnrichmentFlow.decisions.test.tsx`'s.
 */

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

const SUMMARY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  gaps: 12,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryFolders: [],
};

const method = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const path = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').pathname;
const isBulkDismiss = (input: RequestInfo | URL, init?: RequestInit) =>
  path(input) === '/api/enrichment/current/decisions/dismiss' &&
  method(init) === 'POST';

const decision = (
  id: string,
  kind: 'missing' | 'ambiguous',
  title: string
): Decision =>
  kind === 'ambiguous'
    ? {
        id,
        kind,
        title,
        reason: `Reason ${id}.`,
        path: null,
        query: title,
        candidates: [],
      }
    : { id, kind, title, reason: `Reason ${id}.`, path: null, query: title };

const DECISIONS: Decision[] = [
  decision('d1', 'missing', 'Sundial'),
  decision('d2', 'ambiguous', 'Harbor Lights'),
  decision('d3', 'missing', 'Kettle Bay'),
];

const reviewOf = (decisions: Decision[], enriched = 4): EnrichmentRun =>
  makeEnrichmentRun({
    phase: 'review',
    total: 7,
    done: 7,
    enriched,
    decisions,
  });

/** Arrive on a run in review; the bulk dismiss answers with `echo`. */
async function arriveInReview(echo: EnrichmentRun) {
  fetchMock.mockImplementation((input, init) => {
    const p = path(input);
    if (isBulkDismiss(input, init)) {
      return Promise.resolve(okResponse(echo));
    }
    if (p === '/api/enrichment/current' && method(init) === 'GET') {
      return Promise.resolve(okResponse(reviewOf(DECISIONS)));
    }
    if (p === '/api/enrichment' && method(init) === 'GET') {
      return Promise.resolve(okResponse(SUMMARY));
    }
    if (p === '/api/tmdb/key') {
      return Promise.resolve(okResponse({ key: '0123456789abcdef' }));
    }
    return Promise.resolve(notFoundResponse('Not found'));
  });
  render(
    <MemoryRouter initialEntries={['/settings', '/enrich']} initialIndex={1}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <Routes>
            <Route path="/settings" element={<p>the settings hub</p>} />
            <Route path="/enrich" element={<EnrichmentFlow />} />
          </Routes>
        </SnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
  await screen.findByText('Reason d1.');
}

/** The bodies each bulk dismiss posted, in order. */
const posted = (): unknown[] =>
  fetchMock.mock.calls
    .filter(([input, init]) => isBulkDismiss(input, init))
    .map(([, init]) => JSON.parse(String(init?.body)));

/** The value drawn above a tile's label. */
const tile = (label: string) =>
  screen.getByText(label).previousElementSibling?.textContent;

const filter = () =>
  screen.getByRole('group', { name: 'Decision kinds' }) as HTMLElement;
const besideFilter = () => filter().parentElement?.parentElement as HTMLElement;

describe('EnrichmentFlow — Skip all beside a chosen kind', () => {
  it('posts the shown kind’s ids and redraws from the echo', async () => {
    const echo = reviewOf(
      DECISIONS.filter((each) => each.kind !== 'missing'),
      9
    );
    await arriveInReview(echo);

    fireEvent.click(
      within(filter()).getByRole('button', { name: 'Missing 2' })
    );
    fireEvent.click(
      within(besideFilter()).getByRole('button', { name: 'Skip all' })
    );

    await waitFor(() => expect(tile('movies enriched')).toBe('9'));
    expect(posted()).toEqual([{ ids: ['d1', 'd3'] }]);
    expect(tile('need your decision')).toBe('1');
    expect(screen.queryByText('Reason d1.')).toBeNull();
    expect(screen.queryByText('Reason d3.')).toBeNull();
    expect(screen.getByText('Reason d2.')).toBeDefined();
    expect(
      fetchMock.mock.calls.filter(([, init]) => method(init) === 'DELETE')
    ).toEqual([]);
  });

  it('lands on All done when the echo holds nothing left to decide', async () => {
    await arriveInReview(reviewOf([], 4));

    fireEvent.click(
      within(filter()).getByRole('button', { name: 'Ambiguous 1' })
    );
    fireEvent.click(
      within(besideFilter()).getByRole('button', { name: 'Skip all' })
    );

    expect(await screen.findByText('All done')).toBeDefined();
    expect(posted()).toEqual([{ ids: ['d2'] }]);
  });
});
