import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
const item = () => screen.queryByRole('menuitem', { name: 'Edit details' });

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
    expect(screen.getByRole('menuitem', { name: 'Edit details' })).toBeTruthy();
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

    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit details' }));

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
const row = (name: string) => screen.getByRole('menuitem', { name });

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
    expect(screen.queryByRole('menuitem', { name: 'All Genres' })).toBeNull();
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
    expect(screen.queryByRole('menuitem', { name: 'Drama' })).toBeNull();
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

    const panel = panelOf(
      screen.getByRole('menuitem', { name: 'Edit details' })
    );

    expect(getComputedStyle(panel).overflowY).toBe('auto');
  });
});

/**
 * Three rows named for where they sit, because where focus sits is the whole
 * subject of the tests below — `expect(focusedRow()).toBe('Third')` says what
 * it means without a mapping back to a genre or an action. `selected` marks one
 * of them the way a filter list marks the choice it is currently standing on.
 */
function renderOrderedMenu({
  selected,
  onSelect = () => undefined,
}: { selected?: string; onSelect?: (label: string) => void } = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <Menu trigger={(props) => <button {...props}>Options</button>}>
        {['First', 'Second', 'Third'].map((label) => (
          <MenuItem
            key={label}
            selected={label === selected}
            onSelect={() => onSelect(label)}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>
    </ThemeProvider>
  );
}

/** The open panel's rows, in the order they are drawn. */
const orderedRows = () => screen.getAllByRole('menuitem');

/** Which row focus is on, by name — null when focus is not on a row at all. */
function focusedRow() {
  const active = document.activeElement;
  return active?.getAttribute('role') === 'menuitem'
    ? active.textContent
    : null;
}

/** A key pressed where a keyboard user presses it: on whatever holds focus. */
const press = (key: string) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key });

describe('Menu — the ARIA menu pattern', () => {
  it('announces the panel as a menu holding menu items', () => {
    renderOrderedMenu();
    openMenu();

    const panel = screen.getByRole('menu');

    expect(
      within(panel)
        .getAllByRole('menuitem')
        .map((option) => option.textContent)
    ).toEqual(['First', 'Second', 'Third']);
    // The trigger is the only button left in the document: the rows announce
    // themselves as the items of the menu the trigger promised, not as a list
    // of buttons that happens to have appeared.
    expect(
      screen.getAllByRole('button').map((control) => control.textContent)
    ).toEqual(['Options']);
  });
});

describe('Menu — where focus lands when it opens', () => {
  it('puts focus on the first row when no row is marked', () => {
    renderOrderedMenu();

    openMenu();

    expect(focusedRow()).toBe('First');
  });

  it('puts focus on the marked row instead, where there is one', () => {
    // A filter list opens standing on the choice it is already showing, so the
    // next Arrow key moves from there rather than from the top of the list.
    renderOrderedMenu({ selected: 'Second' });

    openMenu();

    expect(focusedRow()).toBe('Second');
  });
});

describe('Menu — moving between the rows', () => {
  it('walks forward on ArrowDown', () => {
    renderOrderedMenu();
    openMenu();

    press('ArrowDown');
    expect(focusedRow()).toBe('Second');

    press('ArrowDown');
    expect(focusedRow()).toBe('Third');
  });

  it('wraps round to the first row past the last', () => {
    renderOrderedMenu({ selected: 'Third' });
    openMenu();

    press('ArrowDown');

    expect(focusedRow()).toBe('First');
  });

  it('walks back on ArrowUp', () => {
    renderOrderedMenu({ selected: 'Third' });
    openMenu();

    press('ArrowUp');

    expect(focusedRow()).toBe('Second');
  });

  it('wraps round to the last row past the first', () => {
    renderOrderedMenu();
    openMenu();

    press('ArrowUp');

    expect(focusedRow()).toBe('Third');
  });

  it('jumps to the ends on Home and End', () => {
    renderOrderedMenu({ selected: 'Second' });
    openMenu();

    press('End');
    expect(focusedRow()).toBe('Third');

    press('Home');
    expect(focusedRow()).toBe('First');
  });
});

describe('Menu — the roving tabindex', () => {
  /** Every row's tab stop, in drawn order. */
  const tabStops = () =>
    orderedRows().map((row) => row.getAttribute('tabindex'));

  it('holds exactly one row in the tab order', () => {
    // One Tab reaches the menu and one Tab leaves it; Arrow keys move about
    // inside. Without this a keyboard user Tabs through every option in turn.
    renderOrderedMenu();
    openMenu();

    expect(tabStops()).toEqual(['0', '-1', '-1']);
  });

  it('opens with the tab stop on the marked row', () => {
    renderOrderedMenu({ selected: 'Second' });
    openMenu();

    expect(tabStops()).toEqual(['-1', '0', '-1']);
  });

  it('moves the tab stop to whichever row focus reaches', () => {
    renderOrderedMenu();
    openMenu();

    press('End');

    expect(tabStops()).toEqual(['-1', '-1', '0']);
    expect(focusedRow()).toBe('Third');
  });
});

describe('Menu — activating the row focus is on', () => {
  it('reports the row the Arrow keys arrived at, and still shuts', () => {
    // The other end of the pattern: moving focus is only worth anything if the
    // row focus lands on is the row that gets used, and the dismissal contract
    // holds for a row reached by keyboard exactly as for one that was clicked.
    const onSelect = vi.fn();
    renderOrderedMenu({ onSelect });
    const control = openMenu();

    press('ArrowDown');
    fireEvent.click(document.activeElement as HTMLElement);

    expect(onSelect).toHaveBeenCalledWith('Second');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(control);
  });
});
