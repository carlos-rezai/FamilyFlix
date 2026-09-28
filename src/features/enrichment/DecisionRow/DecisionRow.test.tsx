import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { DecisionRow, type DecisionRowProps } from './DecisionRow';
import type { Candidate, Decision } from '@/types';
import { theme } from '@/styles/theme';

/**
 * 23 — Enrichment, Phase 4: "ambiguous and missing Decisions" (issue #207).
 *
 * One **Decision row** of the review's list, from `feat.EnrichmentFlow.dc.html`:
 * a 10px dot coloured by kind (`accent` for `ambiguous`, `#c97a6a` — the
 * `danger` ink — for `missing`), the title, the reason, its path when known,
 * and _Skip_ as a ghost `Button`; then one face.
 *
 * - **`ambiguous`** is the `CandidatePicker` — its cards are that unit's
 *   suite's — whose dashed _Search by title_ card swaps the picker for the
 *   search box, prefilled with the title: the row's own choice of face.
 * - **`missing`** is that box: _Search TMDB by title and year_, and _Search_.
 *
 * The row draws a Decision and reports presses — `onPick(tmdbId)`,
 * `onSearch(query)`, `onSkip()` — and knows nothing of what follows.
 */

const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  tmdbId: 101,
  title: 'Harbor Lights',
  year: 1963,
  genre: 'Drama',
  language: 'en',
  posterUrl: 'https://image.tmdb.org/t/p/w185/poster-101.jpg',
  score: 82,
  ...overrides,
});

const AMBIGUOUS: Decision = {
  id: 'd1',
  kind: 'ambiguous',
  title: 'Harbor Lights',
  reason: 'Three releases share this title — pick the right one.',
  path: 'E:\\Movies\\Harbor.Lights.1080p\\',
  query: 'Harbor Lights',
  candidates: [
    candidate(),
    candidate({ tmdbId: 102, year: 2019, score: 74, posterUrl: null }),
    candidate({
      tmdbId: 103,
      title: 'The Harbor Light',
      year: 2005,
      genre: 'Documentary',
      language: 'no',
      score: 51,
      posterUrl: 'https://image.tmdb.org/t/p/w185/poster-103.jpg',
    }),
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

function renderRow(props: Partial<DecisionRowProps> = {}) {
  const handlers = {
    onSkip: vi.fn(),
    onPick: vi.fn<(tmdbId: number) => void>(),
    onSearch: vi.fn<(query: string) => void>(),
    onApply: vi.fn<DecisionRowProps['onApply']>(),
  };
  render(
    <ThemeProvider theme={theme}>
      <DecisionRow
        decision={props.decision ?? AMBIGUOUS}
        onSkip={props.onSkip ?? handlers.onSkip}
        onPick={props.onPick ?? handlers.onPick}
        onSearch={props.onSearch ?? handlers.onSearch}
        onApply={props.onApply ?? handlers.onApply}
      />
    </ThemeProvider>
  );
  return handlers;
}

/** The dot sits before the text block the title and reason are in. */
const dotOf = (title: string): HTMLElement =>
  screen.getByText(title).parentElement?.previousElementSibling as HTMLElement;

const ACCENT = 'rgb(217, 122, 78)';
const DANGER = 'rgb(201, 122, 106)';

const candidateButtons = () =>
  screen.getAllByRole('button', { name: /% match/ });

const searchBox = () =>
  screen.getByPlaceholderText('Search TMDB by title and year');

describe('DecisionRow — what every row shows', () => {
  it('shows the title, the reason under it, and the path under that', () => {
    renderRow();

    const reason = screen.getByText(
      'Three releases share this title — pick the right one.'
    );
    expect(reason.previousElementSibling?.textContent).toBe('Harbor Lights');
    expect(reason.nextElementSibling?.textContent).toBe(AMBIGUOUS.path);
  });

  it('draws no path line when the path is not known', () => {
    renderRow({ decision: MISSING });

    const reason = screen.getByText('Nothing on TMDB matched this title.');
    expect(reason.previousElementSibling?.textContent).toBe('Sundial');
    expect(reason.nextElementSibling).toBeNull();
  });

  it('draws the dot as a 10px circle before the title', () => {
    renderRow();

    const dot = getComputedStyle(
      dotOf('Three releases share this title — pick the right one.')
    );
    expect(dot.width).toBe('10px');
    expect(dot.height).toBe('10px');
  });

  it.each([
    ['ambiguous', AMBIGUOUS, ACCENT],
    ['missing', MISSING, DANGER],
  ] as const)('fills the %s dot in its colour', (_kind, decision, colour) => {
    renderRow({ decision });

    expect(getComputedStyle(dotOf(decision.reason)).backgroundColor).toBe(
      colour
    );
  });

  it('reports Skip', () => {
    const { onSkip } = renderRow();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

describe('DecisionRow — the ambiguous face, the candidate picker', () => {
  it('composes the candidate picker, one card per candidate', () => {
    renderRow();

    expect(candidateButtons()).toHaveLength(3);
  });

  it('reports a pick from the picker by its TMDB id', () => {
    const { onPick } = renderRow();

    fireEvent.click(candidateButtons()[2]);

    expect(onPick).toHaveBeenCalledWith(103);
  });

  it('offers Search by title, and no box until it is pressed', () => {
    renderRow();

    expect(
      screen.getByRole('button', { name: 'Search by title' })
    ).toBeDefined();
    expect(
      screen.queryByPlaceholderText('Search TMDB by title and year')
    ).toBeNull();
  });

  it('swaps the picker for the box, prefilled with the title, on Search by title', () => {
    renderRow();

    fireEvent.click(screen.getByRole('button', { name: 'Search by title' }));

    expect((searchBox() as HTMLInputElement).value).toBe('Harbor Lights');
    expect(screen.queryAllByRole('button', { name: /% match/ })).toHaveLength(
      0
    );
  });
});

describe('DecisionRow — the missing face, the search box', () => {
  it('draws the box prefilled with the query, and Search', () => {
    renderRow({ decision: MISSING });

    expect((searchBox() as HTMLInputElement).value).toBe('Sundial');
    expect(screen.getByRole('button', { name: 'Search' })).toBeDefined();
  });

  it('draws no candidate', () => {
    renderRow({ decision: MISSING });

    expect(screen.queryAllByRole('button', { name: /% match/ })).toHaveLength(
      0
    );
  });

  it('reports the query as typed on Search', () => {
    const { onSearch } = renderRow({ decision: MISSING });

    fireEvent.change(searchBox(), { target: { value: 'Sundial 2004' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledWith('Sundial 2004');
  });
});

describe('the prototype the row translates, amended', () => {
  const prototype = readFileSync(
    join(process.cwd(), 'docs', 'handoff', 'FamilyFlix.dc.html'),
    'utf8'
  );

  it('spells the ambiguous count out rather than fixing it at three', () => {
    expect(prototype).not.toContain(
      'Three releases share this title — pick the right one.'
    );
    expect(prototype).toContain(
      'releases share this title — pick the right one.'
    );
  });

  it('says the missing row searched a title, not a folder name', () => {
    expect(prototype).not.toContain(
      'Nothing on TMDB matched this folder name.'
    );
    expect(prototype).toContain('Nothing on TMDB matched this title.');
  });
});

/**
 * 23 — Enrichment, Phase 5: "conflict Decisions" (issue #208).
 *
 * The third face: a `conflict` row wears the `#c9a86a` dot and draws the
 * **Field conflicts** as the _Yours | TMDB_ diff. _Apply choices_ reports the
 * chosen sides as `onApply(choices)`; _Keep all mine_ is **Dismiss**, so it
 * reports `onSkip()`, as the prototype's `onKeepAll` does.
 */
const CONFLICT: Decision = {
  id: 'd2',
  kind: 'conflict',
  title: 'The Lantern Keeper',
  reason: 'TMDB has different values for fields you already filled in.',
  path: 'E:\\Movies\\The.Lantern.Keeper.2019\\',
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

const GOLD = 'rgb(201, 168, 106)';

describe('DecisionRow — the conflict face, the field diff', () => {
  it('fills the conflict dot in its colour', () => {
    renderRow({ decision: CONFLICT });

    expect(getComputedStyle(dotOf(CONFLICT.reason)).backgroundColor).toBe(GOLD);
  });

  it('draws one Yours | TMDB row per field, and no picker or box', () => {
    renderRow({ decision: CONFLICT });

    expect(screen.getAllByRole('button', { name: /^Yours/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^TMDB/ })).toHaveLength(2);
    expect(screen.getByText('Eleanor Past-Whitlock')).toBeDefined();
    expect(screen.queryAllByRole('button', { name: /% match/ })).toHaveLength(
      0
    );
    expect(
      screen.queryByPlaceholderText('Search TMDB by title and year')
    ).toBeNull();
  });

  it('reports Apply choices with the side chosen for each field', () => {
    const { onApply } = renderRow({ decision: CONFLICT });

    fireEvent.click(screen.getAllByRole('button', { name: /^Yours/ })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Apply choices' }));

    expect(onApply).toHaveBeenCalledWith({ year: 'tmdb', director: 'mine' });
  });

  it('reports Keep all mine as Skip', () => {
    const { onSkip, onApply } = renderRow({ decision: CONFLICT });

    fireEvent.click(screen.getByRole('button', { name: 'Keep all mine' }));

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });
});
