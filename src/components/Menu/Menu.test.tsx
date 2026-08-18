import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { Menu, MenuItem } from '@/components';
import { theme } from '@/styles/theme';

/**
 * A menu with one item, opened by a plain button. The trigger is deliberately
 * unstyled here — what this file tests is the contract, and the point of that
 * contract is that it holds whatever the trigger looks like.
 */
function renderMenu(onSelect: () => void = () => undefined) {
  return render(
    <ThemeProvider theme={theme}>
      <Menu
        trigger={(props) => (
          <button {...props}>{/* icon-free stand-in */}Options</button>
        )}
      >
        <MenuItem glyph="✎" onSelect={onSelect}>
          Edit details
        </MenuItem>
      </Menu>
    </ThemeProvider>
  );
}

const trigger = () => screen.getByRole('button', { name: 'Options' });
const item = () => screen.queryByRole('button', { name: 'Edit details' });

/** Opens it the way a keyboard user does — focus the trigger, then act. */
function openMenu() {
  const control = trigger();
  control.focus();
  fireEvent.click(control);
  return control;
}

describe('Menu', () => {
  it('starts shut, and says so', () => {
    renderMenu();

    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(item()).toBeNull();
  });

  it('opens on the trigger and reports itself open', () => {
    renderMenu();

    const control = openMenu();

    expect(control.getAttribute('aria-expanded')).toBe('true');
    expect(item()).not.toBeNull();
  });

  it('keeps a decorative glyph out of the item’s accessible name', () => {
    renderMenu();
    openMenu();

    // Announced as "Edit details", not "✎ Edit details".
    expect(screen.getByRole('button', { name: 'Edit details' })).toBeTruthy();
  });
});

describe('Menu — the three ways out', () => {
  it('closes on Escape and gives focus back to the trigger', () => {
    renderMenu();
    const control = openMenu();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(item()).toBeNull();
    expect(control.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(control);
  });

  it('closes on a pointerdown outside it and gives focus back to the trigger', () => {
    renderMenu();
    const control = openMenu();

    fireEvent.pointerDown(document.body);

    expect(item()).toBeNull();
    expect(document.activeElement).toBe(control);
  });

  it('stays open on a pointerdown inside its own slot', () => {
    renderMenu();
    const control = openMenu();

    // The trigger is inside the slot, so pressing it is never "outside" — this
    // is what stops a press from closing and reopening in one gesture.
    fireEvent.pointerDown(control);

    expect(item()).not.toBeNull();
  });

  it('closes when the trigger is used a second time', () => {
    renderMenu();
    const control = openMenu();

    fireEvent.click(control);

    expect(item()).toBeNull();
    expect(control.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes when an item is activated, and gives focus back to the trigger', () => {
    const onSelect = vi.fn();
    renderMenu(onSelect);
    const control = openMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(item()).toBeNull();
    expect(document.activeElement).toBe(control);
  });
});

describe('Menu — reopening', () => {
  it('can be opened again after every way of closing it', () => {
    renderMenu();

    openMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    openMenu();
    fireEvent.pointerDown(document.body);
    const control = openMenu();

    expect(item()).not.toBeNull();
    expect(control.getAttribute('aria-expanded')).toBe('true');
  });

  it('stops listening once it is shut, so a stray Escape costs nothing', () => {
    renderMenu();
    openMenu();
    fireEvent.keyDown(document, { key: 'Escape' });

    // Focus is on the trigger and the menu is closed; a second Escape must not
    // throw or re-run the focus return against a panel that is gone.
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(item()).toBeNull();
  });
});

/**
 * The same menu wearing what a filter list needs: one selected row, one row
 * with a count, one plain row. Deliberately a separate helper — the dismissal
 * tests above are the contract these additions must not disturb, so they keep
 * their own single-item menu untouched.
 */
function renderFilterMenu(onSelect: () => void = () => undefined) {
  return render(
    <ThemeProvider theme={theme}>
      <Menu trigger={(props) => <button {...props}>Genre</button>}>
        <MenuItem selected onSelect={() => undefined}>
          All Genres
        </MenuItem>
        <MenuItem trailing="6" onSelect={onSelect}>
          Drama
        </MenuItem>
        <MenuItem onSelect={() => undefined}>Comedy</MenuItem>
      </Menu>
    </ThemeProvider>
  );
}

const filterTrigger = () => screen.getByRole('button', { name: 'Genre' });

function openFilterMenu() {
  const control = filterTrigger();
  control.focus();
  fireEvent.click(control);
  return control;
}

/** A row, found by the name it announces — a count must never be part of it. */
const row = (name: string) => screen.getByRole('button', { name });

describe('MenuItem — marking the current choice', () => {
  it('marks the selected row as current and leaves the rest unmarked', () => {
    renderFilterMenu();
    openFilterMenu();

    expect(row('All Genres').getAttribute('aria-current')).toBe('true');
    expect(row('Drama').getAttribute('aria-current')).toBeNull();
    expect(row('Comedy').getAttribute('aria-current')).toBeNull();
  });

  it('changes nothing about what selecting a marked row does', () => {
    // `selected` is a statement about the row, not a mode: a marked row still
    // reports and still shuts the menu, exactly like an unmarked one.
    const onSelect = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <Menu trigger={(props) => <button {...props}>Genre</button>}>
          <MenuItem selected onSelect={onSelect}>
            All Genres
          </MenuItem>
        </Menu>
      </ThemeProvider>
    );
    const control = openFilterMenu();
    expect(row('All Genres').getAttribute('aria-current')).toBe('true');

    fireEvent.click(row('All Genres'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'All Genres' })).toBeNull();
    expect(document.activeElement).toBe(control);
  });
});

describe('MenuItem — the trailing count', () => {
  it('shows a row’s count, and nothing at all for a row without one', () => {
    renderFilterMenu();
    openFilterMenu();

    expect(row('Drama').textContent).toContain('6');
    expect(row('Comedy').textContent).toBe('Comedy');
  });

  it('keeps the count out of the row’s accessible name', () => {
    // Announced as "Drama", not "Drama 6" — chrome, like the leading glyph. The
    // exact-name query is the assertion: it stops matching if the 6 joins it.
    renderFilterMenu();
    openFilterMenu();

    const drama = row('Drama');

    expect(drama.textContent).toContain('6');
    expect(drama.getAttribute('aria-label')).toBeNull();
  });

  it('still shuts the menu and reports when a counted row is used', () => {
    const onSelect = vi.fn();
    renderFilterMenu(onSelect);
    const control = openFilterMenu();
    expect(row('Drama').textContent).toContain('6');

    fireEvent.click(row('Drama'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Drama' })).toBeNull();
    expect(document.activeElement).toBe(control);
  });
});

describe('Menu — how tall the panel gets', () => {
  /** The panel is the box the rows sit in — reached through the DOM, not a class. */
  const panelOf = (item: HTMLElement) => item.parentElement as HTMLElement;

  it('caps the panel so a long list scrolls inside it', () => {
    renderFilterMenu();
    openFilterMenu();

    const panel = panelOf(row('Drama'));

    expect(getComputedStyle(panel).maxHeight).toBe('340px');
    expect(getComputedStyle(panel).overflowY).toBe('auto');
  });

  it('is inert for a short menu, which shows no scrollbar', () => {
    // `auto`, not `scroll`: the edit menu's four rows fit, so the cap it now
    // carries changes nothing a reader of that menu can see.
    renderMenu();
    openMenu();

    const panel = panelOf(screen.getByRole('button', { name: 'Edit details' }));

    expect(getComputedStyle(panel).overflowY).toBe('auto');
  });
});
