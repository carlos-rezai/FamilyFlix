import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { GenrePicker } from './GenrePicker';
import { theme } from '@/styles/theme';
import type { Genre } from '@/types';

/** A pool small enough to read, in the order the route sends it. */
const POOL: Genre[] = [
  { id: 'g1', name: 'Action' },
  { id: 'g2', name: 'Comedy' },
  { id: 'g3', name: 'Drama' },
  { id: 'g4', name: 'Documentary' },
];

function renderPicker(props: { genres?: Genre[]; selected?: string[] } = {}) {
  const onToggle = vi.fn<(name: string) => void>();
  render(
    <ThemeProvider theme={theme}>
      <GenrePicker
        genres={props.genres ?? POOL}
        selected={props.selected ?? []}
        onToggle={onToggle}
      />
    </ThemeProvider>
  );
  return { onToggle };
}

/** Every chip on screen, in the order it is drawn. */
function chipNames(): string[] {
  return screen
    .getAllByRole('button')
    .map((chip) => chip.textContent?.trim() ?? '');
}

const chip = (name: string) =>
  screen.getByRole('button', { name }) as HTMLButtonElement;

/**
 * The chip row of the **Movie form** — one `Chip` per **Genre pool** entry, and
 * nothing else. It is a molecule's worth of behaviour drawn as a feature
 * sibling: it renders what it is given and reports what was pressed, so which
 * genres exist and which are chosen both stay one level up.
 *
 * `prim.Chip` is used verbatim — its `md` face is already the prototype's pill,
 * and its docblock says it was built for exactly this caller.
 */
describe('GenrePicker', () => {
  it('draws a chip per genre, in the order the pool was given in', () => {
    renderPicker();

    // Migration order, which is the prototype's order. The picker never sorts
    // what it is handed.
    expect(chipNames()).toEqual(['Action', 'Comedy', 'Drama', 'Documentary']);
  });

  it('offers a genre no movie is tagged with, like any other', () => {
    renderPicker();

    // The whole reason the pool is read separately from the genre list: the
    // first Documentary can only be filed under a chip that is already there.
    expect(chip('Documentary')).toBeDefined();
  });

  it('draws every chip as an unpressed toggle when nothing is selected', () => {
    renderPicker();

    // `aria-pressed` is the half of "selected" a screen reader can hear; the
    // accent fill is the half it cannot.
    for (const name of ['Action', 'Comedy', 'Drama', 'Documentary']) {
      expect(chip(name).getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('marks a selected genre as pressed', () => {
    renderPicker({ selected: ['Comedy'] });

    expect(chip('Comedy').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Action').getAttribute('aria-pressed')).toBe('false');
  });

  it('marks several selected genres at once', () => {
    renderPicker({ selected: ['Comedy', 'Documentary'] });

    // Selection is a set, not a choice: a film that is both is filed under
    // both.
    expect(chip('Comedy').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Documentary').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Drama').getAttribute('aria-pressed')).toBe('false');
  });

  it('reports the genre that was pressed', () => {
    const { onToggle } = renderPicker();

    fireEvent.click(chip('Drama'));

    expect(onToggle).toHaveBeenCalledWith('Drama');
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('reports a pressed selected genre the same way, so a toggle is one call', () => {
    const { onToggle } = renderPicker({ selected: ['Drama'] });

    fireEvent.click(chip('Drama'));

    // Deselecting is not a second message. The picker says which chip was
    // pressed; whether that adds or removes is the form's to decide, which is
    // what keeps the selection in one place.
    expect(onToggle).toHaveBeenCalledWith('Drama');
  });

  it('reports each press separately when several chips are pressed', () => {
    const { onToggle } = renderPicker();

    fireEvent.click(chip('Action'));
    fireEvent.click(chip('Drama'));

    expect(onToggle.mock.calls).toEqual([['Action'], ['Drama']]);
  });

  it('draws nothing at all for an empty pool', () => {
    renderPicker({ genres: [] });

    // What a failed `GET /api/genres/pool` leaves behind: no chips, no error
    // surface, and a form that still saves.
    expect(screen.queryAllByRole('button')).toEqual([]);
  });
});
