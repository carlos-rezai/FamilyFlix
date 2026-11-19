import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { DecisionRow } from './DecisionRow';
import type { BusyPhase, Decision } from '@/types';
import { theme } from '@/styles/theme';

/**
 * 69, Silent waits, Phase 2 (issue #654): the Decision row's other presses as
 * a **Busy row**.
 *
 * Which press it was is the row's own; the phase is the review's. Once
 * `shown`, the 18px loader in the kind dot's slot reads that press's own
 * label: _Updating details…_ for _Apply choices_, _Skipping…_ for _Skip_ and
 * _Keep all mine_, _Searching TMDB…_ for _Search_. While `waiting` it reads
 * nothing.
 */

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
      score: 82,
    },
  ],
};

const CONFLICT: Decision = {
  id: 'd2',
  kind: 'conflict',
  title: 'The Lantern Keeper',
  reason: 'TMDB has different values for fields you already filled in.',
  path: null,
  query: 'The Lantern Keeper',
  fields: [{ field: 'year', label: 'Year', mine: '2019', tmdb: '2018' }],
};

const MISSING: Decision = {
  id: 'd3',
  kind: 'missing',
  title: 'Sundial',
  reason: 'Nothing on TMDB matched this title.',
  path: null,
  query: 'Sundial',
};

function tree(decision: Decision, busy: BusyPhase) {
  return (
    <ThemeProvider theme={theme}>
      <DecisionRow
        decision={decision}
        busy={busy}
        onSkip={vi.fn()}
        onPick={vi.fn()}
        onSearch={vi.fn()}
        onApply={vi.fn()}
      />
    </ThemeProvider>
  );
}

const PRESSES: { press: string; decision: Decision; label: string }[] = [
  { press: 'Apply choices', decision: CONFLICT, label: 'Updating details…' },
  { press: 'Keep all mine', decision: CONFLICT, label: 'Skipping…' },
  { press: 'Skip', decision: AMBIGUOUS, label: 'Skipping…' },
  { press: 'Search', decision: MISSING, label: 'Searching TMDB…' },
];

describe.each(PRESSES)(
  'DecisionRow: $press as a Busy row',
  ({ press, decision, label }) => {
    /** The row drawn idle, `press` pressed, then handed `busy`. */
    function pressed(busy: BusyPhase) {
      const view = render(tree(decision, 'idle'));
      fireEvent.click(screen.getByRole('button', { name: press }));
      view.rerender(tree(decision, busy));
      return view;
    }

    it('reads nothing while waiting', () => {
      pressed('waiting');

      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByText(label)).toBeNull();
    });

    it(`reads ${label} once shown, in the kind dot's slot`, () => {
      pressed('shown');

      const loader = screen.getByRole('status', { name: label });
      expect(loader.textContent).toContain(label);
      expect(
        screen.getByText(decision.reason).parentElement?.previousElementSibling
      ).toBe(loader);
    });
  }
);
