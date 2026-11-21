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
 * it draws its **Busy overlay** last in its root, the kind dot kept in its
 * slot (71, issue #680), the overlay's 18px `inline` **Logo loader** reading
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

type Report = 'onSkip' | 'onApply' | 'onPick' | 'onImportAs' | 'onTakeOut';

interface Press {
  press: string;
  problem: ImportProblem;
  /** The control pressed, found on the row. */
  button: () => HTMLElement;
  label: string;
  /** The callback the press reports through. */
  report: Report;
}

const PRESSES: Press[] = [
  {
    press: 'Import as',
    problem: NO_ROW,
    button: () =>
      screen.getByRole('button', { name: 'Import as “Ironwood (2018)”' }),
    label: 'Importing…',
    report: 'onImportAs',
  },
  {
    press: 'a picked Candidate folder',
    problem: AMBIGUOUS,
    button: () => screen.getByRole('button', { name: /^Die Hard \(1988\)/ }),
    label: 'Importing…',
    report: 'onPick',
  },
  {
    press: 'Take out of library',
    problem: MISSING,
    button: () => screen.getByRole('button', { name: 'Take out of library' }),
    label: 'Taking out…',
    report: 'onTakeOut',
  },
  {
    press: 'Apply choices',
    problem: DIFFERS,
    button: () => screen.getByRole('button', { name: 'Apply choices' }),
    label: 'Updating details…',
    report: 'onApply',
  },
  {
    press: 'Keep all mine',
    problem: DIFFERS,
    button: () => screen.getByRole('button', { name: 'Keep all mine' }),
    label: 'Skipping…',
    report: 'onSkip',
  },
  {
    press: 'Skip',
    problem: NO_FOLDER,
    button: () => screen.getByRole('button', { name: 'Skip' }),
    label: 'Skipping…',
    report: 'onSkip',
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

    it('draws no overlay at idle', () => {
      const { container } = render(tree(problem, 'idle'));
      const root = rootOf(container);

      expect(screen.queryByRole('status', { hidden: true })).toBeNull();
      expect(screen.queryByText(label)).toBeNull();
      expect(
        resolvedStyle(root.lastElementChild as HTMLElement).position
      ).not.toBe('absolute');
    });

    it(`stays locked and keeps its kind dot alongside ${label} once shown`, () => {
      const { container } = pressed('shown');
      const root = rootOf(container);

      expect(root.hasAttribute('inert')).toBe(true);
      expect(root.getAttribute('aria-busy')).toBe('true');

      const loader = screen.getByRole('status', { name: label });
      expect(loader.textContent).toContain(label);

      // The dot's slot, right before the title and reason, is still the dot.
      const slot = screen.getByText(problem.reason).parentElement
        ?.previousElementSibling;
      expect(slot).not.toBeNull();
      expect(slot).not.toBe(loader);
      expect(slot?.contains(loader)).toBe(false);
      expect(slot?.getAttribute('role')).not.toBe('status');
      expect(slot?.textContent).toBe('');
    });

    it('draws the overlay last in its root, over the row', () => {
      const { container } = pressed('shown');
      const root = rootOf(container);
      const loader = screen.getByRole('status', { name: label });

      const overlay = root.lastElementChild as HTMLElement;
      expect(overlay.contains(loader)).toBe(true);
      expect(overlay.contains(screen.getByText(problem.reason))).toBe(false);
      expect(resolvedStyle(overlay).position).toBe('absolute');
      expect(Number(loader.querySelector('svg')?.getAttribute('width'))).toBe(
        18
      );
    });

    it('lays out its head once shown as it did at idle', () => {
      const idle = render(tree(problem, 'idle'));
      const head = (reason: string) =>
        screen.getByText(reason).parentElement?.parentElement?.innerHTML;
      const before = head(problem.reason);
      idle.unmount();

      pressed('shown');
      expect(head(problem.reason)).toBe(before);
    });

    it('is not dimmed once shown, a containing block for its overlay', () => {
      const { container } = pressed('shown');
      const drawn = resolvedStyle(rootOf(container));

      // 71, issue #677: `busyRow` drops the dim and the cursor; the root
      // is `position: relative` so the overlay can cover it.
      expect(drawn.opacity).not.toBe('.75');
      expect(drawn.cursor).not.toBe('progress');
      expect(drawn.position).toBe('relative');
    });
  }
);

describe('ProblemRow: refuses a press while locked', () => {
  it.each(
    (['waiting', 'shown'] as const).flatMap((busy) =>
      PRESSES.map((press) => ({ busy, ...press }))
    )
  )(
    'reports nothing for $press while $busy',
    ({ busy, problem, button, report }) => {
      const reports = {
        onSkip: vi.fn(),
        onApply: vi.fn(),
        onPick: vi.fn(),
        onImportAs: vi.fn(),
        onTakeOut: vi.fn(),
      };
      render(
        <MemoryRouter>
          <ThemeProvider theme={theme}>
            <ProblemRow problem={problem} busy={busy} {...reports} />
          </ThemeProvider>
        </MemoryRouter>
      );

      fireEvent.click(button());

      expect(reports[report]).not.toHaveBeenCalled();
    }
  );
});
