import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { FolderRow } from './FolderRow';
import type { BusyPhase, LibraryFolderView } from '@/types';
import { theme } from '@/styles/theme';
import { makeLibraryFolder } from '@/test-support/makeLibraryFolder/makeLibraryFolder';
import { resolvedStyle } from '@/test-support/resolvedStyle/resolvedStyle';

/**
 * 69, Silent waits, Phase 4 (issue #658): the Folder row as a **Busy row**.
 *
 * The page hands the row its `busy` phase; which press it was is the row's
 * own. From `waiting` the row's root is `inert` and `aria-busy`, every
 * control inside keeping its own face, its _N titles_ line still drawn. Once
 * `shown` an 18px `inline` **Logo loader** stands in that line's slot,
 * reading _Removing…_ for the ✕ and _Bringing back…_ for _Bring back_.
 */

const MOVIES: LibraryFolderView = {
  ...makeLibraryFolder({ id: 'f-movies', path: 'E:\\Movies', titleCount: 12 }),
  leftOut: 2,
};

function tree(busy: BusyPhase) {
  return (
    <ThemeProvider theme={theme}>
      <FolderRow
        folder={MOVIES}
        busy={busy}
        onBringBack={vi.fn()}
        onRemove={vi.fn()}
      />
    </ThemeProvider>
  );
}

const PRESSES = [
  {
    press: 'the ✕',
    button: () => screen.getByRole('button', { name: 'Remove E:\\Movies' }),
    label: 'Removing…',
  },
  {
    press: 'Bring back',
    button: () => screen.getByRole('button', { name: 'Bring back' }),
    label: 'Bringing back…',
  },
];

/** The row's root: the one element the render draws. */
const rootOf = (container: HTMLElement) =>
  container.firstElementChild as HTMLElement;

describe.each(PRESSES)(
  'FolderRow: $press as a Busy row',
  ({ button, label }) => {
    /** The row drawn idle, the press made, then handed `busy`. */
    function pressed(busy: BusyPhase) {
      const view = render(tree('idle'));
      fireEvent.click(button());
      view.rerender(tree(busy));
      return view;
    }

    it('is inert and aria-busy from waiting, its line still drawn, reading nothing', () => {
      const { container } = pressed('waiting');
      const root = rootOf(container);

      expect(root.hasAttribute('inert')).toBe(true);
      expect(root.getAttribute('aria-busy')).toBe('true');
      for (const each of Array.from(root.querySelectorAll('button'))) {
        expect(each.disabled).toBe(false);
      }
      expect(screen.getByText('12 titles')).toBeDefined();
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByText(label)).toBeNull();
    });

    it(`reads ${label} once shown, in place of its N titles line`, () => {
      const { container } = pressed('shown');
      const root = rootOf(container);

      expect(root.hasAttribute('inert')).toBe(true);
      expect(root.getAttribute('aria-busy')).toBe('true');

      const loader = screen.getByRole('status', { name: label });
      expect(loader.textContent).toContain(label);
      expect(screen.queryByText('12 titles')).toBeNull();
      expect(screen.getByText('E:\\Movies').nextElementSibling).toBe(loader);
      expect(Number(loader.querySelector('svg')?.getAttribute('width'))).toBe(
        18
      );
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

describe('FolderRow: refuses a press while locked', () => {
  it.each(
    (['waiting', 'shown'] as const).flatMap((busy) =>
      PRESSES.map((press) => ({ busy, ...press }))
    )
  )('reports nothing for $press while $busy', ({ busy, button }) => {
    const onBringBack = vi.fn();
    const onRemove = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <FolderRow
          folder={MOVIES}
          busy={busy}
          onBringBack={onBringBack}
          onRemove={onRemove}
        />
      </ThemeProvider>
    );

    fireEvent.click(button());

    expect(onBringBack).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });
});
