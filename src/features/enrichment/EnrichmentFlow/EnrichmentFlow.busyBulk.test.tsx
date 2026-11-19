import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';

/**
 * 69, Silent waits, Phase 3 (issue #655): _Skip all_ as one wait.
 *
 * With the bulk dismiss held open, _Skip all_ is a Busy button: locked at
 * once, reading _Skipping…_ past 300ms. Every row it covers, every row of the
 * chosen kind, is handed `waiting` for the length of it: `inert` and
 * `aria-busy`, and never a loader of its own. One loader for one wait.
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

const reviewOf = (decisions: Decision[]): EnrichmentRun =>
  makeEnrichmentRun({
    phase: 'review',
    total: 7,
    done: 7,
    enriched: 4,
    decisions,
  });

const pathOf = (url: string) => new URL(url, 'http://localhost').pathname;
const verbOf = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const isBulkDismiss = (url: string, init?: RequestInit) =>
  pathOf(url) === '/api/enrichment/current/decisions/dismiss' &&
  verbOf(init) === 'POST';

/** Every read answered at once; only the bulk dismiss is held open. */
const { fetchMock, respond } = heldFetch((url, init) => {
  const p = pathOf(url);
  if (isBulkDismiss(url, init)) return undefined;
  if (p === '/api/enrichment/current') return okResponse(reviewOf(DECISIONS));
  if (p === '/api/enrichment') return okResponse(SUMMARY);
  if (p === '/api/tmdb/key') return okResponse({ key: '0123456789abcdef' });
  return notFoundResponse('Not found');
});

afterEach(() => {
  vi.useRealTimers();
});

const dismisses = () =>
  fetchMock.mock.calls.filter(([input, init]) =>
    isBulkDismiss(String(input), init)
  );

const filter = () =>
  screen.getByRole('group', { name: 'Decision kinds' }) as HTMLElement;
const besideFilter = () => filter().parentElement?.parentElement as HTMLElement;

/** The Decision row that draws `reason`: the Busy row's root once locked. */
const busyRowOf = (reason: string) =>
  screen.getByText(reason).closest('[aria-busy="true"]');

/** The review drawn, _Missing_ chosen, the clock faked, _Skip all_ pressed. */
async function skippedAllMissing() {
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
  fireEvent.click(within(filter()).getByRole('button', { name: 'Missing 2' }));
  vi.useFakeTimers();
  fireEvent.click(
    within(besideFilter()).getByRole('button', { name: 'Skip all' })
  );
}

describe('EnrichmentFlow: Skip all as a Busy button', () => {
  it('locks Skip all at once, so a second press sends nothing', async () => {
    await skippedAllMissing();

    expect(dismisses()).toHaveLength(1);
    const button = within(besideFilter()).getByRole('button', {
      name: 'Skip all',
    });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect((button as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(button);
    await advanceClock(0);
    expect(dismisses()).toHaveLength(1);

    await respond(okResponse(reviewOf([DECISIONS[1]])));
    await advanceClock(500);
  });

  it('reads Skipping… past 300ms', async () => {
    await skippedAllMissing();

    await advanceClock(299);
    expect(
      within(besideFilter()).queryByRole('button', { name: 'Skipping…' })
    ).toBeNull();
    await advanceClock(1);
    expect(
      within(besideFilter()).getByRole('button', { name: 'Skipping…' })
    ).toBeDefined();

    await respond(okResponse(reviewOf([DECISIONS[1]])));
    await advanceClock(500);
  });
});

describe('EnrichmentFlow: the rows Skip all covers', () => {
  it('locks every covered row at once', async () => {
    await skippedAllMissing();

    for (const reason of ['Reason d1.', 'Reason d3.']) {
      const row = busyRowOf(reason);
      expect(row).not.toBeNull();
      expect(row?.hasAttribute('inert')).toBe(true);
    }

    await respond(okResponse(reviewOf([DECISIONS[1]])));
    await advanceClock(500);
  });

  it('draws no loader in any covered row, even once Skipping… is shown', async () => {
    await skippedAllMissing();
    await advanceClock(300);

    for (const reason of ['Reason d1.', 'Reason d3.']) {
      const row = busyRowOf(reason) as HTMLElement | null;
      expect(row).not.toBeNull();
      expect(row?.hasAttribute('inert')).toBe(true);
      expect(
        within(row as HTMLElement).queryAllByRole('status', { hidden: true })
      ).toEqual([]);
    }

    await respond(okResponse(reviewOf([DECISIONS[1]])));
    await advanceClock(500);
  });
});
