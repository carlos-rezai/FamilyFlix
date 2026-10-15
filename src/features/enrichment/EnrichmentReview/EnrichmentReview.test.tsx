import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { theme } from '@/styles/theme';
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
import { LocationProbe, url } from '@/test-support/LocationProbe/LocationProbe';
import { resolvedStyle } from '@/test-support/resolvedStyle/resolvedStyle';
import { Button } from '@/primitives';
import type { Decision, EnrichmentRun } from '@/types';
import {
  EnrichmentReview,
  type EnrichmentReviewProps,
} from './EnrichmentReview';

/**
 * 23 — Enrichment refactor (issue #214), Group 4: the three steps have suites.
 *
 * The **Review step** driven through its props alone: the two stat tiles,
 * _All done_ with _Saved to …_ when nothing is left to decide — its sentences
 * moved down from `EnrichmentFlow.writeBack.test.tsx`, their combinations now
 * `writtenSummary`'s — else one **Decision row** per Decision, reporting by
 * its id; then Finish under the label it is handed, and _Sync again_.
 */

const MISSING: Decision = {
  id: 'd1',
  kind: 'missing',
  title: 'Sundial',
  reason: 'Nothing on TMDB matched this title.',
  path: null,
  query: 'Sundial',
};

const REVIEWED = makeEnrichmentRun({
  phase: 'review',
  total: 12,
  done: 12,
  enriched: 11,
  decisions: [MISSING],
});

function renderReview(props: Partial<EnrichmentReviewProps> = {}) {
  const handlers = {
    onFinish: vi.fn(),
    onAgain: vi.fn(),
    onSkip: vi.fn<(id: string) => void>(),
    onSkipMany: vi.fn<EnrichmentReviewProps['onSkipMany']>(),
    onPick: vi.fn<(id: string, tmdbId: number) => void>(),
    onSearch: vi.fn<(id: string, query: string) => void>(),
    onApply: vi.fn<EnrichmentReviewProps['onApply']>(),
  };
  render(
    <ThemeProvider theme={theme}>
      <EnrichmentReview
        run={REVIEWED}
        finishLabel="Done"
        {...handlers}
        {...props}
      />
    </ThemeProvider>
  );
  return handlers;
}

const allDone = (written: EnrichmentRun['written']) =>
  makeEnrichmentRun({ phase: 'review', enriched: 12, written });

describe('EnrichmentReview — the tiles', () => {
  it('counts the titles enriched and the ones that need a decision', () => {
    renderReview();

    expect(screen.getByText('11')).toBeDefined();
    expect(screen.getByText('movies enriched')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('need your decision')).toBeDefined();
  });
});

describe('EnrichmentReview — the list', () => {
  it('draws one Decision row per Decision, and no All done', () => {
    renderReview();

    expect(
      screen.getByText('Nothing on TMDB matched this title.')
    ).toBeDefined();
    expect(screen.queryByText('All done')).toBeNull();
  });

  it('reports a row’s Skip by its Decision’s id', () => {
    const { onSkip } = renderReview();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(onSkip).toHaveBeenCalledWith('d1');
  });

  it('reports a row’s search by its Decision’s id', () => {
    const { onSearch } = renderReview();

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledWith('d1', 'Sundial');
  });
});

describe('EnrichmentReview — All done', () => {
  it('draws All done, and no row, with nothing left to decide', () => {
    renderReview({ run: allDone({ sheet: false, posters: false }) });

    expect(screen.getByText('All done')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });

  it('names your library alone when nothing landed in the root', () => {
    renderReview({ run: allDone({ sheet: false, posters: false }) });

    expect(screen.getByText('Saved to your library.')).toBeDefined();
  });

  it('names the sheet and the posters when both landed', () => {
    renderReview({ run: allDone({ sheet: true, posters: true }) });

    expect(
      screen.getByText(
        'Saved to your library, the sheet in your collection root, a poster.jpg in each movie folder.'
      )
    ).toBeDefined();
  });

  it('names one target alone when only it landed', () => {
    renderReview({ run: allDone({ sheet: true, posters: false }) });

    expect(
      screen.getByText(
        'Saved to your library, the sheet in your collection root.'
      )
    ).toBeDefined();
  });
});

describe('EnrichmentReview — Finish and Sync again', () => {
  it('names Finish as it is told', () => {
    renderReview({ finishLabel: 'Back to the movie' });

    expect(
      screen.getByRole('button', { name: 'Back to the movie' })
    ).toBeDefined();
  });

  it('reports Finish and Sync again', () => {
    const { onFinish, onAgain } = renderReview();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sync again' }));

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onAgain).toHaveBeenCalledTimes(1);
  });
});

/**
 * 42 — Review at scale (issue #358): the Sync's review stays ungrouped. Only
 * the Import review draws **Review groups**; a Sync raises at most one
 * Decision per title, and its list stays a plain one even when two share one.
 */
describe('EnrichmentReview — no Review groups', () => {
  it('draws two Decisions sharing a title as two plain rows, nothing to open', () => {
    const twin: Decision = {
      ...MISSING,
      id: 'd2',
      reason: 'A second look found nothing either.',
    };
    renderReview({
      run: makeEnrichmentRun({
        phase: 'review',
        enriched: 3,
        decisions: [MISSING, twin],
      }),
    });

    expect(
      screen.getByText('Nothing on TMDB matched this title.')
    ).toBeDefined();
    expect(
      screen.getByText('A second look found nothing either.')
    ).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Skip' })).toHaveLength(2);
    expect(document.querySelector('[aria-expanded]')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });
});

/**
 * 42 — Review at scale (issue #359): the **Kind filter**.
 *
 * The Import review's filter over the Sync's Decisions — `PillTabs` labelled
 * _Decision kinds_: _All N_, then _Ambiguous_, _Missing_, _Conflict_ each with
 * its count, only those present, drawn with two kinds or more. Filtered, never
 * grouped. A pill whose kind empties goes and the filter falls back to _All_;
 * the URL never moves.
 */
describe('EnrichmentReview — the Kind filter', () => {
  const decision = (id: string, kind: Decision['kind']): Decision => {
    const base = {
      id,
      title: `Title ${id}`,
      reason: `Reason ${id}.`,
      path: null,
      query: `Title ${id}`,
    };
    if (kind === 'ambiguous') return { ...base, kind, candidates: [] };
    if (kind === 'conflict')
      return {
        ...base,
        kind,
        fields: [{ field: 'year', label: 'Year', mine: '2019', tmdb: '2018' }],
      };
    return { ...base, kind };
  };

  const inReview = (decisions: Decision[]) =>
    makeEnrichmentRun({ phase: 'review', enriched: 4, decisions });

  /** Out of the glossary's order on purpose, with uneven counts. */
  const MIXED: Decision[] = [
    decision('1', 'conflict'),
    decision('2', 'missing'),
    decision('3', 'ambiguous'),
    decision('4', 'conflict'),
  ];

  const filter = () => screen.queryByRole('group', { name: 'Decision kinds' });
  const pills = () =>
    within(filter() as HTMLElement)
      .getAllByRole('button')
      .map((pill) => pill.textContent);
  const pill = (name: string) =>
    within(filter() as HTMLElement).getByRole('button', { name });

  function renderWith(run: EnrichmentRun) {
    const view = (r: EnrichmentRun) => (
      <MemoryRouter initialEntries={['/enrich']}>
        <ThemeProvider theme={theme}>
          <EnrichmentReview
            run={r}
            finishLabel="Done"
            onFinish={() => undefined}
            onAgain={() => undefined}
            onSkip={() => undefined}
            onSkipMany={() => undefined}
            onPick={() => undefined}
            onSearch={() => undefined}
            onApply={() => undefined}
          />
          <LocationProbe />
        </ThemeProvider>
      </MemoryRouter>
    );
    const rendered = render(view(run));
    return { rerenderWith: (r: EnrichmentRun) => rendered.rerender(view(r)) };
  }

  it('draws the filter, named Decision kinds, when the list holds two kinds', () => {
    renderWith(inReview([decision('1', 'missing'), decision('2', 'conflict')]));

    expect(filter()).not.toBeNull();
  });

  it('draws no filter when every Decision is of one kind', () => {
    renderWith(inReview([decision('1', 'missing'), decision('2', 'missing')]));

    expect(filter()).toBeNull();
    expect(screen.getByText('Reason 1.')).toBeDefined();
    expect(screen.getByText('Reason 2.')).toBeDefined();
  });

  it('reads All N, then each kind present with its count, in the glossary’s order', () => {
    renderWith(inReview(MIXED));

    expect(pills()).toEqual([
      'All 4',
      'Ambiguous 1',
      'Missing 1',
      'Conflict 2',
    ]);
  });

  it('draws a pill only for a kind the list holds', () => {
    renderWith(
      inReview([decision('1', 'conflict'), decision('2', 'ambiguous')])
    );

    expect(pills()).toEqual(['All 2', 'Ambiguous 1', 'Conflict 1']);
  });

  it('opens on All, pressed, with every Decision shown', () => {
    renderWith(inReview(MIXED));

    expect(pill('All 4').getAttribute('aria-pressed')).toBe('true');
    for (const id of ['1', '2', '3', '4']) {
      expect(screen.getByText(`Reason ${id}.`)).toBeDefined();
    }
  });

  it('shows only the chosen kind’s Decisions once its pill is pressed', () => {
    renderWith(inReview(MIXED));

    fireEvent.click(pill('Conflict 2'));

    expect(pill('Conflict 2').getAttribute('aria-pressed')).toBe('true');
    expect(pill('All 4').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('Reason 1.')).toBeDefined();
    expect(screen.getByText('Reason 4.')).toBeDefined();
    expect(screen.queryByText('Reason 2.')).toBeNull();
    expect(screen.queryByText('Reason 3.')).toBeNull();
  });

  it('shows everything again once All is pressed', () => {
    renderWith(inReview(MIXED));
    fireEvent.click(pill('Missing 1'));

    fireEvent.click(pill('All 4'));

    expect(pill('All 4').getAttribute('aria-pressed')).toBe('true');
    for (const id of ['1', '2', '3', '4']) {
      expect(screen.getByText(`Reason ${id}.`)).toBeDefined();
    }
  });

  it('takes a kind’s pill away once its last Decision is settled, and falls back to All', () => {
    const { rerenderWith } = renderWith(inReview(MIXED));
    fireEvent.click(pill('Missing 1'));

    rerenderWith(inReview(MIXED.filter((d) => d.kind !== 'missing')));

    expect(pills()).toEqual(['All 3', 'Ambiguous 1', 'Conflict 2']);
    expect(pill('All 3').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Reason 1.')).toBeDefined();
    expect(screen.getByText('Reason 3.')).toBeDefined();
    expect(screen.getByText('Reason 4.')).toBeDefined();
  });

  it('takes the filter away once one kind is left', () => {
    const { rerenderWith } = renderWith(inReview(MIXED));
    fireEvent.click(pill('Ambiguous 1'));

    rerenderWith(inReview(MIXED.filter((d) => d.kind === 'conflict')));

    expect(filter()).toBeNull();
    expect(screen.getByText('Reason 1.')).toBeDefined();
    expect(screen.getByText('Reason 4.')).toBeDefined();
  });

  it('keeps the choice out of the URL', () => {
    renderWith(inReview(MIXED));

    fireEvent.click(pill('Conflict 2'));

    expect(url()).toBe('/enrich');
  });

  it('shows All done and no filter with nothing left to decide', () => {
    renderWith(inReview([]));

    expect(screen.getByText('All done')).toBeDefined();
    expect(filter()).toBeNull();
  });

  it('sets the track in a sideways-scrolling wrapper', () => {
    renderWith(inReview(MIXED));

    const wrapper = (filter() as HTMLElement).parentElement as HTMLElement;
    expect(resolvedStyle(wrapper)['overflow-x']).toBe('auto');
  });
});

/**
 * 41 — Review at scale, Phase 6: "Skip all in the Sync review" (issue #362).
 *
 * From `feat.EnrichmentFlow.dc.html` as amended: _Skip all_ (`ghost`) at the
 * end of the **Kind filter**'s row while a kind is chosen, for every kind —
 * the Sync has no _Keep all mine_. A press is reported at once, no confirm,
 * with the ids of the Decisions shown, in the run's order; the step takes
 * nothing off itself — the run hook does, and the next `run` shows it.
 */
describe('EnrichmentReview — Skip all beside a chosen kind', () => {
  const decision = (id: string, kind: Decision['kind']): Decision => {
    const base = {
      id,
      title: `Title ${id}`,
      reason: `Reason ${id}.`,
      path: null,
      query: `Title ${id}`,
    };
    if (kind === 'ambiguous') return { ...base, kind, candidates: [] };
    if (kind === 'conflict')
      return {
        ...base,
        kind,
        fields: [{ field: 'year', label: 'Year', mine: '2019', tmdb: '2018' }],
      };
    return { ...base, kind };
  };

  const MIXED: Decision[] = [
    decision('1', 'conflict'),
    decision('2', 'missing'),
    decision('3', 'ambiguous'),
    decision('4', 'conflict'),
    decision('5', 'missing'),
  ];

  const inReview = (decisions: Decision[]) =>
    makeEnrichmentRun({ phase: 'review', enriched: 4, decisions });

  const filter = () =>
    screen.getByRole('group', { name: 'Decision kinds' }) as HTMLElement;
  const pill = (name: string) => within(filter()).getByRole('button', { name });
  /** The Kind filter's row: the track's wrapper's parent, where Skip all sits. */
  const besideFilter = () =>
    filter().parentElement?.parentElement as HTMLElement;
  const skipAll = () =>
    within(besideFilter()).queryByRole('button', { name: 'Skip all' });

  function renderWith(
    run: EnrichmentRun,
    handlers: Partial<EnrichmentReviewProps> = {}
  ) {
    const view = (r: EnrichmentRun) => (
      <ThemeProvider theme={theme}>
        <EnrichmentReview
          run={r}
          finishLabel="Done"
          onFinish={() => undefined}
          onAgain={() => undefined}
          onSkip={() => undefined}
          onSkipMany={() => undefined}
          onPick={() => undefined}
          onSearch={() => undefined}
          onApply={() => undefined}
          {...handlers}
        />
      </ThemeProvider>
    );
    const rendered = render(view(run));
    return { rerenderWith: (r: EnrichmentRun) => rendered.rerender(view(r)) };
  }

  it('draws no Skip all while All is chosen', () => {
    renderWith(inReview(MIXED));

    expect(skipAll()).toBeNull();
  });

  it.each(['Ambiguous 1', 'Missing 2', 'Conflict 2'])(
    'draws Skip all beside the filter once %s is chosen',
    (name) => {
      renderWith(inReview(MIXED));

      fireEvent.click(pill(name));

      expect(skipAll()).not.toBeNull();
      expect(
        within(besideFilter()).queryByRole('button', { name: 'Keep all mine' })
      ).toBeNull();
    }
  );

  it('draws Skip all as the ghost Button at md', () => {
    renderWith(inReview(MIXED));
    fireEvent.click(pill('Missing 2'));
    const drawn = skipAll() as HTMLElement;

    const { getByRole } = render(
      <ThemeProvider theme={theme}>
        <Button label="Skip all" variant="ghost" size="md" onClick={() => {}} />
      </ThemeProvider>,
      { container: document.body.appendChild(document.createElement('div')) }
    );

    expect(drawn.className).toBe(
      getByRole('button', { name: 'Skip all' }).className
    );
  });

  it('reports every Decision of the chosen kind, in the run’s order, at once — no confirm', () => {
    const onSkipMany = vi.fn<EnrichmentReviewProps['onSkipMany']>();
    const onSkip = vi.fn();
    renderWith(inReview(MIXED), { onSkipMany, onSkip });

    fireEvent.click(pill('Conflict 2'));
    fireEvent.click(skipAll() as HTMLElement);

    expect(onSkipMany).toHaveBeenCalledTimes(1);
    expect(onSkipMany).toHaveBeenCalledWith(['1', '4']);
    expect(onSkip).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('takes nothing off itself; the kind’s pill goes once the run drops its Decisions, and the filter falls back to All', () => {
    const { rerenderWith } = renderWith(inReview(MIXED));
    fireEvent.click(pill('Missing 2'));
    fireEvent.click(skipAll() as HTMLElement);
    expect(screen.getByText('Reason 2.')).toBeDefined();

    rerenderWith(inReview(MIXED.filter((d) => d.kind !== 'missing')));

    expect(screen.queryByText('Reason 2.')).toBeNull();
    expect(screen.queryByText('Reason 5.')).toBeNull();
    expect(pill('All 3').getAttribute('aria-pressed')).toBe('true');
    expect(skipAll()).toBeNull();
  });
});
