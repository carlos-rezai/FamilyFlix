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
 * `shown` it draws its **Busy overlay** last in its root, the line kept and
 * the row no taller (71, issue #680), the overlay's 18px `inline` **Logo
 * loader** reading _Removing…_ for the ✕ and _Bringing back…_ for _Bring
 * back_.
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

    it('draws no overlay at idle', () => {
      const { container } = render(tree('idle'));
      const root = rootOf(container);

      expect(screen.queryByRole('status', { hidden: true })).toBeNull();
      expect(screen.queryByText(label)).toBeNull();
      expect(
        resolvedStyle(root.lastElementChild as HTMLElement).position
      ).not.toBe('absolute');
    });

    it(`stays locked and keeps its N titles line alongside ${label} once shown`, () => {
      const { container } = pressed('shown');
      const root = rootOf(container);

      expect(root.hasAttribute('inert')).toBe(true);
      expect(root.getAttribute('aria-busy')).toBe('true');

      const loader = screen.getByRole('status', { name: label });
      expect(loader.textContent).toContain(label);
      const line = screen.getByText('12 titles');
      expect(screen.getByText(MOVIES.path).nextElementSibling).toBe(line);
      expect(line.contains(loader)).toBe(false);
    });

    it('draws the overlay last in its root, over the row', () => {
      const { container } = pressed('shown');
      const root = rootOf(container);
      const loader = screen.getByRole('status', { name: label });

      const overlay = root.lastElementChild as HTMLElement;
      expect(overlay.contains(loader)).toBe(true);
      expect(overlay.contains(screen.getByText('12 titles'))).toBe(false);
      expect(resolvedStyle(overlay).position).toBe('absolute');
      expect(Number(loader.querySelector('svg')?.getAttribute('width'))).toBe(
        18
      );
    });

    it('never grows taller: its text column once shown is as at idle', () => {
      const idle = render(tree('idle'));
      const column = () =>
        screen.getByText(MOVIES.path).parentElement?.innerHTML;
      const before = column();
      idle.unmount();

      pressed('shown');
      expect(column()).toBe(before);
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
