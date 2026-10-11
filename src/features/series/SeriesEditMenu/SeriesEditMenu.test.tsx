import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { SeriesEditMenu } from './SeriesEditMenu';
import { theme } from '@/styles/theme';

/**
 * 38 — Title editing, Slice 1: "delete a series" (issue #304).
 *
 * The **Series edit menu**: `EditMenu`'s ⋯ on `CornerMenu`'s furniture, in the
 * series hero's corner. In this slice it holds the **Danger row** alone —
 * _🗑 Delete series_ — which opens the series' Delete dialog. Opening, closing
 * and focus return belong to `mol.Menu`; what is checked here is that this menu
 * keeps that contract as the movie page's does, and what its row opens.
 */
let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderMenu(seriesId = 'harbor', title = 'Harbor & Vine', count = 22) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/series/harbor']}>
        <SeriesEditMenu
          seriesId={seriesId}
          title={title}
          episodeCount={count}
        />
      </MemoryRouter>
    </ThemeProvider>
  );
}

const trigger = () => screen.getByRole('button', { name: 'More options' });
const openMenu = () => fireEvent.click(trigger());
const selectDelete = () =>
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete series' }));
const dialog = () => screen.queryByRole('dialog');

describe('SeriesEditMenu — the menu', () => {
  it('offers a named ⋯ trigger, closed until pressed', () => {
    renderMenu();

    expect(trigger()).toBeTruthy();
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('holds the Danger row alone, Delete series in the danger ink', () => {
    renderMenu();

    openMenu();

    const items = screen.getAllByRole('menuitem');
    expect(
      items.map((item) => item.textContent?.replace('🗑', '').trim())
    ).toEqual(['Delete series']);
    const remove = screen.getByRole('menuitem', { name: 'Delete series' });
    expect(remove.textContent).toContain('🗑');
    expect(getComputedStyle(remove).color).toBe('rgb(201, 122, 106)');
  });

  it('closes from Escape and gives focus back to ⋯, as the movie page’s does', () => {
    renderMenu();
    trigger().focus();
    fireEvent.click(trigger());
    expect(
      screen.getByRole('menuitem', { name: 'Delete series' })
    ).toBeTruthy();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });

    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });
});

describe('SeriesEditMenu — the Delete dialog', () => {
  it('keeps the dialog shut until the row is used', () => {
    renderMenu();

    openMenu();

    expect(dialog()).toBeNull();
  });

  it('closes the menu and opens the dialog, naming the show and its episodes', () => {
    renderMenu('harbor', 'Harbor & Vine', 22);
    openMenu();

    selectDelete();

    expect(
      screen.queryByRole('menuitem', { name: 'Delete series' })
    ).toBeNull();
    const open = screen.getByRole('dialog', {
      name: 'Delete “Harbor & Vine”?',
    });
    expect(within(open).getByText(/its 22 episodes/)).toBeTruthy();
  });

  it('closes the dialog from Cancel, sends nothing, and leaves focus on ⋯', () => {
    renderMenu();
    trigger().focus();
    fireEvent.click(trigger());
    selectDelete();

    fireEvent.click(
      within(dialog() as HTMLElement).getByRole('button', { name: 'Cancel' })
    );

    expect(dialog()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes the dialog from Escape and leaves focus on ⋯', () => {
    renderMenu();
    trigger().focus();
    fireEvent.click(trigger());
    selectDelete();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });

    expect(dialog()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger());
  });

  it('can open the dialog again after it was dismissed', () => {
    renderMenu();
    openMenu();
    selectDelete();
    fireEvent.click(
      within(dialog() as HTMLElement).getByRole('button', { name: 'Close' })
    );
    expect(dialog()).toBeNull();

    openMenu();
    selectDelete();

    expect(
      screen.getByRole('dialog', { name: 'Delete “Harbor & Vine”?' })
    ).toBeTruthy();
  });
});
