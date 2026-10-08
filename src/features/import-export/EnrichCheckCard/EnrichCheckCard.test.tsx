import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { EnrichCheckCard, type EnrichCheckCardProps } from './EnrichCheckCard';
import { theme } from '@/styles/theme';

/**
 * 30 — Library folders, Phase 4: "the Sync over folders" (issue #271).
 *
 * _Also fetch metadata and posters from TMDB_, extracted from `ImportSetup` on
 * its second caller — the Library folders page's group **Scan** — and drawn as
 * `feat.ImportFlow.dc.html` draws it: a `<label>` card over the one native
 * checkbox, clipped by `visuallyHidden` so it keeps its place in the tab
 * order, the 22px box first in it, the 15px label and the 13px hint under it.
 * The hint is chosen by whether a TMDB key is stored. Controlled: `checked`,
 * `keySet` and `onToggle` are handed in. `ImportSetup`'s own suite still
 * covers the card where it is composed.
 */

const LABEL = 'Also fetch metadata and posters from TMDB';
const HINT_WITH_KEY =
  'Runs straight after the import, over everything it brings in. Needs the internet.';
const HINT_WITHOUT_KEY =
  'Needs a TMDB key — add one under Settings → Network first.';

function renderCard(props: Partial<EnrichCheckCardProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <EnrichCheckCard
        checked={false}
        keySet={true}
        onToggle={() => undefined}
        {...props}
      />
    </ThemeProvider>
  );
}

const checkbox = () =>
  screen.getByRole('checkbox', { name: new RegExp(LABEL) }) as HTMLInputElement;
const card = () => {
  const label = checkbox().closest('label');
  if (label === null) throw new Error('no card around the checkbox');
  return label;
};
const box = () => card().firstElementChild as HTMLElement;

describe('EnrichCheckCard — the box', () => {
  it('draws one checkbox named by its label', () => {
    renderCard();

    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getByText(LABEL)).toBeDefined();
  });

  it('is unticked when unchecked and ticked when checked', () => {
    const { unmount } = renderCard({ checked: false });
    expect(checkbox().checked).toBe(false);
    expect(box().textContent).toBe('');
    unmount();

    renderCard({ checked: true });
    expect(checkbox().checked).toBe(true);
    expect(box().textContent).toBe('✓');
  });

  it('reports a press on the card', () => {
    const onToggle = vi.fn();
    renderCard({ onToggle });

    fireEvent.click(card());

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('toggles on Space, as a checkbox does', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderCard({ onToggle });
    checkbox().focus();

    await user.keyboard(' ');

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('keeps the native checkbox clipped rather than out of the tree', () => {
    renderCard();

    const style = getComputedStyle(checkbox());
    expect(style.display).not.toBe('none');
    expect(style.position).toBe('absolute');
    expect(style.width).toBe('1px');
  });
});

describe('EnrichCheckCard — the hint', () => {
  it('reads the with-key hint when a key is stored', () => {
    renderCard({ keySet: true });

    expect(screen.getByText(HINT_WITH_KEY)).toBeDefined();
    expect(screen.queryByText(HINT_WITHOUT_KEY)).toBeNull();
  });

  it('reads the without-key hint when none is', () => {
    renderCard({ keySet: false });

    expect(screen.getByText(HINT_WITHOUT_KEY)).toBeDefined();
    expect(screen.queryByText(HINT_WITH_KEY)).toBeNull();
  });
});

describe('EnrichCheckCard — drawn as the prototype draws it', () => {
  it('is the surface card: 14px 16px padding, a soft border, 10px corners', () => {
    renderCard();
    const style = getComputedStyle(card());

    expect(style.display).toBe('flex');
    expect(style.paddingTop).toBe('14px');
    expect(style.paddingLeft).toBe('16px');
    expect(style.backgroundColor).toBe('rgb(33, 27, 21)');
    expect(style.borderTopColor).toBe('rgb(44, 36, 27)');
    expect(style.borderRadius).toBe('10px');
    expect(style.cursor).toBe('pointer');
  });

  it('fills the ticked box with the accent', () => {
    renderCard({ checked: true });

    expect(getComputedStyle(box()).backgroundColor).toBe('rgb(217, 122, 78)');
  });
});
