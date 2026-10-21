import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { CheckCard, type CheckCardProps } from '@/components';
import { theme } from '@/styles/theme';

/**
 * Release review (issue #424): `mol.CheckCard.dc.html`.
 *
 * A ticked option drawn as a card, graduated from `EnrichCheckCard` when the
 * Library folders page drew _Scan every folder again_ above the TMDB box: a
 * `<label>` card over the one native checkbox, clipped so it keeps its place
 * in the tab order, the 22px box first in it, then the 15px label and the 13px
 * hint under it, both the caller's. It holds nothing, and a press reports.
 * Props: `checked`, `label`, `hint`, `onToggle()`.
 */

const LABEL = 'Scan every folder again';
const HINT =
  'Reads the folders already scanned too, for files added or changed since. Nothing already in the library is imported twice.';

function renderCard(props: Partial<CheckCardProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <CheckCard
        checked={false}
        label={LABEL}
        hint={HINT}
        onToggle={() => undefined}
        {...props}
      />
    </ThemeProvider>
  );
}

const checkbox = (label = LABEL) =>
  screen.getByRole('checkbox', { name: new RegExp(label) }) as HTMLInputElement;
const card = () => {
  const label = checkbox().closest('label');
  if (label === null) throw new Error('no card around the checkbox');
  return label;
};
const box = () => card().firstElementChild as HTMLElement;

describe('CheckCard — the caller’s words', () => {
  it('draws one checkbox named by the label it is handed', () => {
    renderCard();

    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getByText(LABEL)).toBeDefined();
  });

  it('draws the hint it is handed under the label', () => {
    renderCard();

    const hint = screen.getByText(HINT);
    expect(
      screen.getByText(LABEL).compareDocumentPosition(hint) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('draws whichever label and hint another caller hands it', () => {
    renderCard({ label: 'Another option', hint: 'Another sentence.' });

    expect(checkbox('Another option')).toBeDefined();
    expect(screen.getByText('Another sentence.')).toBeDefined();
    expect(screen.queryByText(LABEL)).toBeNull();
  });
});

describe('CheckCard — the box', () => {
  it('is unticked when unchecked and ticked when checked', () => {
    const { unmount } = renderCard({ checked: false });
    expect(checkbox().checked).toBe(false);
    expect(box().textContent).toBe('');
    unmount();

    renderCard({ checked: true });
    expect(checkbox().checked).toBe(true);
    expect(box().textContent).toBe('✓');
  });

  it('reports a press on the card, holding nothing itself', () => {
    const onToggle = vi.fn();
    renderCard({ onToggle });

    fireEvent.click(card());

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(checkbox().checked).toBe(false);
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

describe('CheckCard — drawn as the prototype draws it', () => {
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
