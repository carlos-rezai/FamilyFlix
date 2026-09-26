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
 * 23 — Enrichment, Phase 4: "ambiguous and missing Decisions" (issue #207).
 *
 * The **Review step** holding **Decisions**, opened on a run already in
 * review (re-attached on mount). The seam is `fetch`, `ImportFlow`'s
 * precedent; the notices go through the real `SnackbarProvider`.
 *
 * - The two tiles sit over the list, one **Decision row** per Decision.
 * - _Skip_ sends `DELETE /api/enrichment/current/decisions/:id`; the row
 *   leaves the list.
 * - Picking a candidate sends `…/pick { tmdbId }`, raises _Match saved._, and
 *   the settled row leaves the list and counts into _movies enriched_.
 * - Searching sends `…/search { query }`, raises _Searching TMDB…_, and draws
 *   the answer: candidates in the picker, or the box kept with _Nothing on
 *   TMDB matched “{query}”._
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
  libraryRoot: null,
};

const AMBIGUOUS: Decision = {
  id: 'd1',
  kind: 'ambiguous',
  title: 'Harbor Lights',
  reason: 'Two releases share this title — pick the right one.',
  path: '',
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
  path: '',
  query: 'Sundial',
};

function reviewRun(overrides: Partial<EnrichmentRun> = {}): EnrichmentRun {
  return {
    id: 'run-1',
    phase: 'review',
    scope: 'missing',
    startedAt: new Date(Date.now() - 12000).toISOString(),
    total: 6,
    done: 6,
    enriched: 4,
    currentItem: null,
    log: [
      {
        text: '✓ Sync complete — 4 enriched, 2 need a decision.',
        kind: 'success',
      },
    ],
    decisions: [AMBIGUOUS, MISSING],
    written: { sheet: false, posters: false },
    ...overrides,
  };
}

const method = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const path = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').pathname;

const DECISION =
  /^\/api\/enrichment\/current\/decisions\/([^/]+)(?:\/(search|pick))?$/;

/**
 * A server holding a run in review. Skip and pick take the row off (a pick
 * counting it into `enriched`); a search answers `searchAnswer(query)` and
 * puts it on the run in the row's place.
 */
function serve({
  searchAnswer = (query: string): Decision => ({
    ...MISSING,
    query,
    reason: `Nothing on TMDB matched “${query}”.`,
  }),
}: { searchAnswer?: (query: string) => Decision } = {}) {
  let held = reviewRun();
  fetchMock.mockImplementation((input, init) => {
    const p = path(input);
    const decision = DECISION.exec(p);
    if (decision !== null) {
      const id = decodeURIComponent(decision[1]);
      const action = decision[2];
      const found = held.decisions.some((each) => each.id === id);
      if (!found) {
        return Promise.resolve(notFoundResponse('No such decision'));
      }
      if (action === undefined && method(init) === 'DELETE') {
        held = {
          ...held,
          decisions: held.decisions.filter((each) => each.id !== id),
        };
        return Promise.resolve(noContentResponse());
      }
      if (action === 'pick' && method(init) === 'POST') {
        held = {
          ...held,
          enriched: held.enriched + 1,
          decisions: held.decisions.filter((each) => each.id !== id),
        };
        return Promise.resolve(noContentResponse());
      }
      if (action === 'search' && method(init) === 'POST') {
        const { query } = JSON.parse(String(init?.body)) as { query: string };
        const answer = { ...searchAnswer(query), id };
        held = {
          ...held,
          decisions: held.decisions.map((each) =>
            each.id === id ? answer : each
          ),
        };
        return Promise.resolve(okResponse(answer));
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

const searchBox = () =>
  screen.getByPlaceholderText('Search TMDB by title and year');

describe('EnrichmentFlow — the review’s Decisions', () => {
  it('lists one Decision row per Decision, each with its reason', async () => {
    renderFlow();

    expect(
      await screen.findByText(
        'Two releases share this title — pick the right one.'
      )
    ).toBeDefined();
    expect(
      screen.getByText('Nothing on TMDB matched this title.')
    ).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Skip' })).toHaveLength(2);
    expect(tile('need your decision')).toBe('2');
    expect(screen.queryByText('All done')).toBeNull();
  });
});

describe('EnrichmentFlow — Skip', () => {
  it('sends the DELETE and takes the row off the list', async () => {
    renderFlow();
    await screen.findByText('Nothing on TMDB matched this title.');

    fireEvent.click(screen.getAllByRole('button', { name: 'Skip' })[1]);

    await waitFor(() => {
      expect(
        sent('/api/enrichment/current/decisions/d3', 'DELETE')
      ).toBeDefined();
      expect(
        screen.queryByText('Nothing on TMDB matched this title.')
      ).toBeNull();
    });
    expect(tile('need your decision')).toBe('1');
    expect(tile('movies enriched')).toBe('4');
  });
});

describe('EnrichmentFlow — picking a candidate', () => {
  it('sends the pick with the candidate’s TMDB id', async () => {
    renderFlow();
    await screen.findByText(
      'Two releases share this title — pick the right one.'
    );

    fireEvent.click(screen.getByRole('button', { name: /70% match/ }));

    await waitFor(() => {
      const call = sent('/api/enrichment/current/decisions/d1/pick', 'POST');
      expect(call).toBeDefined();
      expect(bodyOf(call)).toEqual({ tmdbId: 102 });
    });
  });

  it('raises Match saved.', async () => {
    renderFlow();
    await screen.findByText(
      'Two releases share this title — pick the right one.'
    );

    fireEvent.click(screen.getByRole('button', { name: /100% match/ }));

    expect(
      await within(snackbarStack()).findByText('Match saved.')
    ).toBeDefined();
  });

  it('takes the settled row off and counts it into movies enriched', async () => {
    renderFlow();
    await screen.findByText(
      'Two releases share this title — pick the right one.'
    );

    fireEvent.click(screen.getByRole('button', { name: /100% match/ }));

    await waitFor(() => {
      expect(
        screen.queryByText(
          'Two releases share this title — pick the right one.'
        )
      ).toBeNull();
      expect(tile('movies enriched')).toBe('5');
      expect(tile('need your decision')).toBe('1');
    });
  });
});

describe('EnrichmentFlow — searching', () => {
  it('sends the query as typed and raises Searching TMDB…', async () => {
    renderFlow();
    await screen.findByText('Nothing on TMDB matched this title.');

    fireEvent.change(searchBox(), { target: { value: 'Sundial 2004' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      const call = sent('/api/enrichment/current/decisions/d3/search', 'POST');
      expect(call).toBeDefined();
      expect(bodyOf(call)).toEqual({ query: 'Sundial 2004' });
    });
    expect(
      await within(snackbarStack()).findByText('Searching TMDB…')
    ).toBeDefined();
  });

  it('answers candidates in the picker', async () => {
    serve({
      searchAnswer: (query) => ({
        ...AMBIGUOUS,
        title: 'Sundial',
        reason: 'One release shares this title — pick the right one.',
        query,
        candidates: [
          {
            tmdbId: 601,
            title: 'Sundial',
            year: 2004,
            genre: 'Drama',
            language: 'en',
            posterUrl: null,
            score: 82,
          },
        ],
      }),
    });
    renderFlow();
    await screen.findByText('Nothing on TMDB matched this title.');

    fireEvent.change(searchBox(), { target: { value: 'Sundial 2004' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(
      await screen.findByRole('button', { name: /82% match/ })
    ).toBeDefined();
  });

  it('keeps the box, with its line, when nothing matched', async () => {
    renderFlow();
    await screen.findByText('Nothing on TMDB matched this title.');

    fireEvent.change(searchBox(), { target: { value: 'Sundal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(
      await screen.findByText('Nothing on TMDB matched “Sundal”.')
    ).toBeDefined();
    expect(searchBox()).toBeDefined();
  });
});
