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
