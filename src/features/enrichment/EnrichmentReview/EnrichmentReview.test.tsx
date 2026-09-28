import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
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
