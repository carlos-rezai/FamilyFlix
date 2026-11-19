import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { EnrichmentFlow } from './EnrichmentFlow';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import type { Decision, EnrichmentRun, EnrichmentSummary } from '@/types';
import { theme } from '@/styles/theme';
import {
  noContentResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';
import { snackbarStack } from '@/test-support/snackbarStack/snackbarStack';

/**
 * 69, Silent waits, Phase 1 (issue #653): one row, end to end.
 *
 * On the Sync review, with the pick route held open: the picked **Decision
 * row** locks at once, so a second press on it sends nothing, while every
 * other row stays pressable; past 300ms it reads _Saving match…_; and it
 * leaves, with _Match saved._, only once the 500ms hold is out.
 *
 * The review is read on real timers; the clock is faked from the press on.
 */

const SUMMARY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  gaps: 12,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryFolders: [],
};

const AMBIGUOUS: Decision = {
  id: 'd1',
  kind: 'ambiguous',
  title: 'Harbor Lights',
  reason: 'Two releases share this title. Pick the right one.',
  path: null,
  query: 'Harbor Lights',
  candidates: [
    {
      tmdbId: 101,
      title: 'Harbor Lights',
      year: 1963,
      genre: 'Drama',
      language: 'en',
      posterUrl: null,
      score: 100,
    },
    {
      tmdbId: 102,
      title: 'Harbor Lights',
      year: 2019,
      genre: 'Drama',
      language: 'en',
      posterUrl: null,
      score: 70,
    },
  ],
};

const MISSING: Decision = {
  id: 'd3',
  kind: 'missing',
  title: 'Sundial',
  reason: 'Nothing on TMDB matched this title.',
  path: null,
  query: 'Sundial',
};

const REVIEW: EnrichmentRun = {
  id: 'run-1',
  phase: 'review',
  scope: 'missing',
  startedAt: '2026-11-19T10:00:00.000Z',
  total: 6,
  done: 6,
  enriched: 4,
  currentItem: null,
  log: [
    {
      text: '✓ Sync complete: 4 enriched, 2 need a decision.',
      kind: 'success',
    },
  ],
  decisions: [AMBIGUOUS, MISSING],
  written: { sheet: false, posters: false },
};

const pathOf = (url: string) => new URL(url, 'http://localhost').pathname;
const verbOf = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();

/** Every read and a Skip answered at once; only a pick is held open. */
const { fetchMock, respond } = heldFetch((url, init) => {
  const p = pathOf(url);
  const verb = verbOf(init);
  if (/\/pick$/.test(p) && verb === 'POST') return undefined;
  if (p.startsWith('/api/enrichment/current/decisions/') && verb === 'DELETE') {
    return noContentResponse();
  }
  if (p === '/api/enrichment/current') return okResponse(REVIEW);
  if (p === '/api/enrichment') return okResponse(SUMMARY);
  if (p === '/api/tmdb/key') return okResponse({ key: '0123456789abcdef' });
  return notFoundResponse('Not found');
});

afterEach(() => {
  vi.useRealTimers();
});

const picks = () =>
  fetchMock.mock.calls.filter(
    ([input, init]) =>
      pathOf(String(input)) === '/api/enrichment/current/decisions/d1/pick' &&
      verbOf(init) === 'POST'
  );

const harborReason = () =>
  screen.queryByText('Two releases share this title. Pick the right one.');

/** The review drawn, then the clock faked and Harbor Lights' 100% pressed. */
async function pickedHarbor() {
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
  await screen.findByText('Two releases share this title. Pick the right one.');
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: /100% match/ }));
}

describe('EnrichmentFlow: a pick as a Busy row', () => {
  it('locks the picked row at once: a second press sends no second request', async () => {
    await pickedHarbor();

    expect(picks()).toHaveLength(1);
    const row = harborReason()?.closest('[aria-busy="true"]');
    expect(row).not.toBeNull();
    expect(row?.hasAttribute('inert')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /70% match/ }));
    fireEvent.click(screen.getByRole('button', { name: /100% match/ }));
    await advanceClock(0);
    expect(picks()).toHaveLength(1);

    await respond(noContentResponse());
    await advanceClock(500);
  });

  it('leaves the other rows pressable while the pick waits', async () => {
    await pickedHarbor();

    const sundial = screen
      .getByText('Nothing on TMDB matched this title.')
      .closest('[aria-busy="true"]');
    expect(sundial).toBeNull();
    expect(harborReason()?.closest('[aria-busy="true"]')).not.toBeNull();

    const skips = screen.getAllByRole('button', { name: 'Skip' });
    fireEvent.click(skips[1]);
    await advanceClock(0);

    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          pathOf(String(input)) === '/api/enrichment/current/decisions/d3' &&
          verbOf(init) === 'DELETE'
      )
    ).toBe(true);
    expect(
      screen.queryByText('Nothing on TMDB matched this title.')
    ).toBeNull();
  });

  it('reads Saving match… past 300ms, and leaves with Match saved. only after the hold', async () => {
    await pickedHarbor();

    await advanceClock(299);
    expect(screen.queryByRole('status', { name: 'Saving match…' })).toBeNull();
    await advanceClock(1);
    expect(screen.getByRole('status', { name: 'Saving match…' })).toBeDefined();

    // The pick lands at 400; the hold runs to 800.
    await advanceClock(100);
    await respond(noContentResponse());
    await advanceClock(399);
    expect(harborReason()).not.toBeNull();
    expect(within(snackbarStack()).queryByText('Match saved.')).toBeNull();

    await advanceClock(1);
    expect(harborReason()).toBeNull();
    expect(within(snackbarStack()).getByText('Match saved.')).toBeDefined();
  });
});
