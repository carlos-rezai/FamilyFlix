import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { EditMenu } from './EditMenu';
import { theme } from '@/styles/theme';
import { MoreButton } from './EditMenu.styles';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';

/**
 * Opening, closing and focus return belong to `mol.Menu` and are tested there.
 * What is left for this file is the part that is this menu's own: which control
 * opens it, what it offers, where that offer goes — and, since it owns the
 * **Danger row**, whether the **Delete dialog** it opens is open.
 */
function renderEditMenu(movieId = 'm1', title = 'Northwind') {
  function Probe() {
    const location = useLocation();
    return (
      <span data-testid="destination">{`${location.pathname}${location.search}`}</span>
    );
  }

  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/movie/m1']}>
        <EditMenu movieId={movieId} title={title} />
        <Probe />
      </MemoryRouter>
    </ThemeProvider>
  );
}

const openMenu = () =>
  fireEvent.click(screen.getByRole('button', { name: 'More options' }));

describe('EditMenu', () => {
  it('offers a named ⋯ trigger', () => {
    renderEditMenu();

    expect(screen.getByRole('button', { name: 'More options' })).toBeTruthy();
  });

  it('draws Delete movie after Edit details, as the danger row', () => {
    renderEditMenu();

    openMenu();

    const edit = screen.getByRole('menuitem', { name: 'Edit details' });
    const remove = screen.getByRole('menuitem', { name: 'Delete movie' });
    expect(comesBefore(edit, remove)).toBe(true);
    // The glyph is drawn and kept out of the name; the ink is the `danger`
    // token, #c97a6a as jsdom reports it.
    expect(remove.textContent).toContain('🗑');
    expect(getComputedStyle(remove).color).toBe('rgb(201, 122, 106)');
  });

  it('sends Edit details to the add screen carrying this movie', () => {
    renderEditMenu('northwind-1994');

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit details' }));

    expect(screen.getByTestId('destination').textContent).toBe(
      '/add?movie=northwind-1994'
    );
  });

  it('encodes the movie’s id into the query, so it reads back whole', () => {
    // A raw `&` would end `movie` early and start a parameter of its own.
    renderEditMenu('m 2/y&problem=p1');

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit details' }));

    const destination = screen.getByTestId('destination').textContent ?? '';
    const query = new URLSearchParams(destination.split('?')[1] ?? '');
    expect(destination.startsWith('/add?')).toBe(true);
    expect(query.get('movie')).toBe('m 2/y&problem=p1');
    expect(query.has('problem')).toBe(false);
  });
});

describe('EditMenu — the Delete dialog', () => {
  const dialog = () => screen.queryByRole('dialog');
  const selectDelete = () =>
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete movie' }));

  it('keeps the dialog shut until the row is used', () => {
    renderEditMenu();

    openMenu();

    expect(dialog()).toBeNull();
  });

  it('closes the menu and opens the dialog, titled with this movie’s name', () => {
    renderEditMenu('m1', 'Northwind');
    openMenu();

    selectDelete();

    expect(screen.queryByRole('menuitem', { name: 'Delete movie' })).toBeNull();
    expect(
      screen.getByRole('dialog', { name: 'Delete “Northwind”?' })
    ).toBeTruthy();
  });

  it('titles the dialog with whichever movie the menu is for', () => {
    renderEditMenu('harbor-2016', 'The Quiet Harbor');
    openMenu();

    selectDelete();

    expect(
      screen.getByRole('dialog', { name: 'Delete “The Quiet Harbor”?' })
    ).toBeTruthy();
  });

  it('closes the dialog from Cancel', () => {
    renderEditMenu();
    openMenu();
    selectDelete();
    const open = dialog();
    expect(open).not.toBeNull();

    fireEvent.click(
      within(open as HTMLElement).getByRole('button', { name: 'Cancel' })
    );

    expect(dialog()).toBeNull();
  });

  it('closes the dialog from the ✕', () => {
    renderEditMenu();
    openMenu();
    selectDelete();
    const open = dialog();
    expect(open).not.toBeNull();

    fireEvent.click(
      within(open as HTMLElement).getByRole('button', { name: 'Close' })
    );

    expect(dialog()).toBeNull();
  });

  it('leaves focus on the ⋯ trigger after Cancel', () => {
    renderEditMenu();
    const control = screen.getByRole('button', { name: 'More options' });
    control.focus();
    fireEvent.click(control);
    selectDelete();

    // Two dismissal contracts, and neither leaks: the menu has already given
    // focus back to ⋯ before the dialog takes it, so the dialog's own return
    // lands on ⋯ too — the Maintainer is back exactly where they started.
    fireEvent.click(
      within(dialog() as HTMLElement).getByRole('button', { name: 'Cancel' })
    );

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(control);
  });

  it('leaves focus on the ⋯ trigger after Escape', () => {
    renderEditMenu();
    const control = screen.getByRole('button', { name: 'More options' });
    control.focus();
    fireEvent.click(control);
    selectDelete();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(control);
  });

  it('can open the dialog again after it was dismissed', () => {
    renderEditMenu();
    openMenu();
    selectDelete();
    fireEvent.click(
      within(dialog() as HTMLElement).getByRole('button', { name: 'Cancel' })
    );
    expect(dialog()).toBeNull();

    openMenu();
    selectDelete();

    expect(
      screen.getByRole('dialog', { name: 'Delete “Northwind”?' })
    ).toBeTruthy();
  });
});

/**
 * 21 — Motion & interaction states, Phase 4 (issue #184): the ⋯ button on
 * IconButton's Control states; its file draws no scale.
 *
 * jsdom computes no `:hover`, `:active` or `:focus-visible`, so each state is
 * what the injected stylesheet resolves to for the rendered button in that
 * state — the cascade run by `resolvedStyle` — never a computed style.
 */
describe('EditMenu — the ⋯ button through hover, press and focus', () => {
  it('shows a press and the ring, and does not scale on hover', () => {
    render(
      <ThemeProvider theme={theme}>
        <MoreButton label="More options">
          <span />
        </MoreButton>
      </ThemeProvider>
    );
    const button = screen.getByRole('button', { name: 'More options' });

    expect(resolvedStyle(button, { hover: true }).transform ?? 'none').toBe(
      'none'
    );
    const press = resolvedStyle(button, { hover: true, active: true });
    expect(press.transform).toBe(normCss('scale(.94)'));
    expect(press['transition-duration']).toBe('60ms');
    expect(resolvedStyle(button, { focusVisible: true })['box-shadow']).toBe(
      normCss(`0 0 0 3px ${theme.colors.focusRing}`)
    );
  });
});
