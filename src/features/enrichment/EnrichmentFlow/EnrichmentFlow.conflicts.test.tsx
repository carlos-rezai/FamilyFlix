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
import {
  noContentResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { snackbarStack } from '@/test-support/snackbarStack/snackbarStack';

/**
 * 23 — Enrichment, Phase 5: "conflict Decisions" (issue #208).
 *
 * The **Review step** holding a `conflict` **Decision**, opened on a run
 * already in review (re-attached on mount). The seam is `fetch`, the
 * decisions suite's precedent; the notices go through the real
 * `SnackbarProvider`.
 *
 * - The row draws the _Yours | TMDB_ diff, every field on TMDB.
 * - _Apply choices_ sends `POST …/decisions/:id/apply { choices }`, raises
 *   _Details updated._, and the settled row leaves the list and counts into
 *   _movies enriched_.
 * - _Keep all mine_ sends the Dismiss `DELETE`; the row leaves, nothing is
 *   counted, and nothing is raised.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

const SUMMARY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryFolders: [],
};

const REASON = 'TMDB has different values for fields you already filled in.';

const CONFLICT: Decision = {
  id: 'd2',
  kind: 'conflict',
  title: 'The Lantern Keeper',
  reason: REASON,
  path: null,
  query: 'The Lantern Keeper',
  fields: [
    { field: 'year', label: 'Year', mine: '2019', tmdb: '2018' },
    {
      field: 'director',
      label: 'Director',
      mine: 'Eleanor Past',
      tmdb: 'Eleanor Past-Whitlock',
    },
  ],
};

function reviewRun(): EnrichmentRun {
  return {
    id: 'run-1',
    phase: 'review',
    scope: 'all',
    startedAt: new Date(Date.now() - 12000).toISOString(),
    total: 5,
    done: 5,
    enriched: 4,
    currentItem: null,
    log: [
      {
        text: '✓ Sync complete — 4 enriched, 1 need a decision.',
        kind: 'success',
      },
    ],
    decisions: [CONFLICT],
    written: { sheet: false, posters: false },
  };
}

const method = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const path = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').pathname;

const DECISION =
  /^\/api\/enrichment\/current\/decisions\/([^/]+)(?:\/(apply))?$/;

/** A server holding a run in review; apply and Dismiss take the row off. */
function serve() {
  let held = reviewRun();
  fetchMock.mockImplementation((input, init) => {
    const p = path(input);
    const decision = DECISION.exec(p);
    if (decision !== null) {
      const id = decodeURIComponent(decision[1]);
      const action = decision[2];
      if (!held.decisions.some((each) => each.id === id)) {
        return Promise.resolve(notFoundResponse('No such decision'));
      }
      if (action === undefined && method(init) === 'DELETE') {
        held = {
          ...held,
          decisions: held.decisions.filter((each) => each.id !== id),
        };
        return Promise.resolve(noContentResponse());
      }
      if (action === 'apply' && method(init) === 'POST') {
        held = {
          ...held,
          enriched: held.enriched + 1,
          decisions: held.decisions.filter((each) => each.id !== id),
        };
        return Promise.resolve(noContentResponse());
      }
    }
    if (p === '/api/enrichment/current' && method(init) === 'GET') {
      return Promise.resolve(okResponse(held));
    }
    if (p === '/api/enrichment' && method(init) === 'GET') {
      return Promise.resolve(okResponse(SUMMARY));
    }
    if (p === '/api/tmdb/key') {
      return Promise.resolve(okResponse({ key: '0123456789abcdef' }));
    }
    return Promise.resolve(notFoundResponse('Not found'));
  });
}

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>();
  vi.stubGlobal('fetch', fetchMock);
  serve();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderFlow() {
  return render(
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
}

/** The request the screen sent to `url` with `verb`, or `undefined`. */
const sent = (url: string, verb: string) =>
  fetchMock.mock.calls.find(([i, n]) => path(i) === url && method(n) === verb);

const bodyOf = (call: ReturnType<typeof sent>) =>
  JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>;

/** The value drawn above a tile's label. */
const tile = (label: string) =>
  screen.getByText(label).previousElementSibling?.textContent;

describe('EnrichmentFlow — the conflict row', () => {
  it('draws the diff with every field on TMDB', async () => {
    renderFlow();
    await screen.findByText(REASON);

    const sides = screen.getAllByRole('button', { name: /^TMDB/ });
    expect(sides).toHaveLength(2);
    for (const side of sides) {
      expect(side.getAttribute('aria-pressed')).toBe('true');
    }
  });
});

describe('EnrichmentFlow — Apply choices', () => {
  it('sends the side chosen for each field', async () => {
    renderFlow();
    await screen.findByText(REASON);

    fireEvent.click(screen.getAllByRole('button', { name: /^Yours/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Apply choices' }));

    await waitFor(() => {
      const call = sent('/api/enrichment/current/decisions/d2/apply', 'POST');
      expect(call).toBeDefined();
      expect(bodyOf(call)).toEqual({
        choices: { year: 'mine', director: 'tmdb' },
      });
    });
  });

  it('raises Details updated.', async () => {
    renderFlow();
    await screen.findByText(REASON);

    fireEvent.click(screen.getByRole('button', { name: 'Apply choices' }));

    expect(
      await within(snackbarStack()).findByText('Details updated.')
    ).toBeDefined();
  });

  it('takes the settled row off and counts it into movies enriched', async () => {
    renderFlow();
    await screen.findByText(REASON);

    fireEvent.click(screen.getByRole('button', { name: 'Apply choices' }));

    await waitFor(() => {
      expect(screen.queryByText(REASON)).toBeNull();
      expect(tile('movies enriched')).toBe('5');
    });
  });
});

describe('EnrichmentFlow — Keep all mine', () => {
  it('sends the Dismiss, applies nothing, and takes the row off', async () => {
    renderFlow();
    await screen.findByText(REASON);

    fireEvent.click(screen.getByRole('button', { name: 'Keep all mine' }));

    await waitFor(() => {
      expect(
        sent('/api/enrichment/current/decisions/d2', 'DELETE')
      ).toBeDefined();
      expect(screen.queryByText(REASON)).toBeNull();
    });
    expect(
      sent('/api/enrichment/current/decisions/d2/apply', 'POST')
    ).toBeUndefined();
    expect(tile('movies enriched')).toBe('4');
    expect(within(snackbarStack()).queryByText('Details updated.')).toBeNull();
  });
});
