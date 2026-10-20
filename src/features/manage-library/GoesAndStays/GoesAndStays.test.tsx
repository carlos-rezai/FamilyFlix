import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { GoesAndStays } from './GoesAndStays';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';

/**
 * 47 — Manage library: **What goes** beside **What stays**, the molecule the
 * Clear dialog and the Delete dialog both draw — each heading over its own
 * list, What goes first, every line in the caller's order.
 */
function renderLists(goes: string[], stays: string[]) {
  return render(
    <ThemeProvider theme={theme}>
      <GoesAndStays goes={goes} stays={stays} />
    </ThemeProvider>
  );
}

const listUnder = (heading: string) =>
  screen.getByText(heading).nextElementSibling as HTMLElement;

const linesOf = (list: HTMLElement) =>
  Array.from(list.querySelectorAll('li')).map((item) => item.textContent);

describe('GoesAndStays', () => {
  it('draws both headings, What goes first', () => {
    renderLists(['A'], ['B']);

    expect(
      comesBefore(screen.getByText('What goes'), screen.getByText('What stays'))
    ).toBe(true);
  });

  it('lists What goes under its heading, in order', () => {
    renderLists(['Its details', 'Its folder'], ['Nothing']);

    expect(linesOf(listUnder('What goes'))).toEqual([
      'Its details',
      'Its folder',
    ]);
  });

  it('lists What stays under its heading, in order', () => {
    renderLists(['Its details'], ['Its title and files', 'Watch history']);

    expect(linesOf(listUnder('What stays'))).toEqual([
      'Its title and files',
      'Watch history',
    ]);
  });
});
