import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { ProblemRow } from './ProblemRow';
import type { BusyPhase, ImportProblem } from '@/types';
import { theme } from '@/styles/theme';
import { resolvedStyle } from '@/test-support/resolvedStyle/resolvedStyle';

/**
 * 69, Silent waits, Phase 3 (issue #656): the Problem row as a **Busy row**.
 *
 * The review hands the row its `busy` phase; which press it was is the row's
 * own. From `waiting` the row's root is `inert` and `aria-busy`, every
 * control inside keeping its own face, and nothing is read yet. Once `shown`
 * an 18px `inline` **Logo loader** stands in the kind dot's slot, reading
 * that press's own label: _Importing…_ for _Import as “…”_ and a picked
 * **Candidate folder**, _Taking out…_ for _Take out of library_, _Updating
 * details…_ for _Apply choices_, and _Skipping…_ for _Skip_ and _Keep all
 * mine_.
 */

const NO_ROW: ImportProblem = {
  id: 'p1',
  kind: 'no-row',
  title: 'Ironwood (2018)',
  reason: "Folder isn't in the spreadsheet.",
  guess: 'Ironwood (2018)',
};

const AMBIGUOUS: ImportProblem = {
  id: 'p2',
  kind: 'ambiguous',
  title: 'Die Hard',
  reason: 'Two folders look like plausible matches. Pick one.',
  candidates: [
    {
      path: 'D:/Films/Die.Hard.1988.1080p',
      name: 'Die.Hard.1988.1080p',
      videos: 1,
    },
    { path: 'D:/Films/Die Hard (1988)', name: 'Die Hard (1988)', videos: 2 },
  ],
};

const DIFFERS: ImportProblem = {
  id: 'p3',
  kind: 'differs',
  title: 'Heat',
  reason: 'The spreadsheet differs from the library.',
  movieId: 'm-heat',
  differences: [
    { field: 'director', label: 'Director', mine: 'Mann', sheet: 'M. Mann' },
  ],
};

const MISSING: ImportProblem = {
  id: 'p4',
  kind: 'missing',
  title: 'Sundial',
  reason: 'Its video is gone from the folder.',
  movieId: 'm-sundial',
  takeOut: 'Take out of library',
};

const NO_FOLDER: ImportProblem = {
  id: 'p5',
  kind: 'no-folder',
  title: 'The Lantern Keeper',
  reason: 'No folder found matching this spreadsheet row.',
};

function tree(problem: ImportProblem, busy: BusyPhase) {
  return (
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <ProblemRow
          problem={problem}
          busy={busy}
          onSkip={vi.fn()}
          onApply={vi.fn()}
          onPick={vi.fn()}
          onImportAs={vi.fn()}
          onTakeOut={vi.fn()}
        />
      </ThemeProvider>
    </MemoryRouter>
  );
}

interface Press {
  press: string;
  problem: ImportProblem;
  /** The control pressed, found on the row. */
  button: () => HTMLElement;
  label: string;
}

const PRESSES: Press[] = [
  {
    press: 'Import as',
    problem: NO_ROW,
    button: () =>
      screen.getByRole('button', { name: 'Import as “Ironwood (2018)”' }),
    label: 'Importing…',
  },
  {
    press: 'a picked Candidate folder',
    problem: AMBIGUOUS,
    button: () => screen.getByRole('button', { name: /^Die Hard \(1988\)/ }),
    label: 'Importing…',
  },
  {
    press: 'Take out of library',
    problem: MISSING,
    button: () => screen.getByRole('button', { name: 'Take out of library' }),
    label: 'Taking out…',
  },
  {
    press: 'Apply choices',
    problem: DIFFERS,
    button: () => screen.getByRole('button', { name: 'Apply choices' }),
    label: 'Updating details…',
  },
  {
    press: 'Keep all mine',
    problem: DIFFERS,
    button: () => screen.getByRole('button', { name: 'Keep all mine' }),
    label: 'Skipping…',
  },
  {
    press: 'Skip',
    problem: NO_FOLDER,
    button: () => screen.getByRole('button', { name: 'Skip' }),
    label: 'Skipping…',
  },
];

/** The row's root: the one element the render draws. */
const rootOf = (container: HTMLElement) =>
  container.firstElementChild as HTMLElement;

describe.each(PRESSES)(
  'ProblemRow: $press as a Busy row',
  ({ problem, button, label }) => {
    /** The row drawn idle, the press made, then handed `busy`. */
    function pressed(busy: BusyPhase) {
      const view = render(tree(problem, 'idle'));
      fireEvent.click(button());
      view.rerender(tree(problem, busy));
      return view;
    }

    it('is inert and aria-busy from waiting, every control in its own face, reading nothing', () => {
      const { container } = pressed('waiting');
      const root = rootOf(container);

      expect(root.hasAttribute('inert')).toBe(true);
      expect(root.getAttribute('aria-busy')).toBe('true');
      for (const each of Array.from(root.querySelectorAll('button'))) {
        expect(each.disabled).toBe(false);
      }
      expect(button()).toBeDefined();

      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByText(label)).toBeNull();
      expect(resolvedStyle(root).opacity).not.toBe('.75');
    });

    it(`stays locked and reads ${label} once shown, in the kind dot's slot`, () => {
      const { container } = pressed('shown');
      const root = rootOf(container);

      expect(root.hasAttribute('inert')).toBe(true);
      expect(root.getAttribute('aria-busy')).toBe('true');

      const loader = screen.getByRole('status', { name: label });
      expect(loader.textContent).toContain(label);
      expect(
        screen.getByText(problem.reason).parentElement?.previousElementSibling
      ).toBe(loader);
      expect(Number(loader.querySelector('svg')?.getAttribute('width'))).toBe(
        18
      );
    });

    it('dims to .75 under a progress cursor once shown', () => {
      const { container } = pressed('shown');
      const drawn = resolvedStyle(rootOf(container));

      expect(drawn.opacity).toBe('.75');
      expect(drawn.cursor).toBe('progress');
    });
  }
);
