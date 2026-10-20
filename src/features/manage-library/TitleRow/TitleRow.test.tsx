import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { TitleRow } from './TitleRow';
import type { LibraryTitle } from '@/types';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import {
  makeLibraryMovie,
  makeLibrarySeries,
} from '@/test-support/makeLibraryTitle/makeLibraryTitle';

/**
 * 47 — Manage library, Phase 1: "the list, read-only" (issue #407).
 *
 * One **Title row** on the **Manage library page**, on the **Folder row**'s
 * furniture: the 40px accent tile with the folder glyph, the title and its
 * year (none when absent, a **Year range** for a show), the path in mono,
 * then the meta line — the _Linked_ / _Copied_ badge, _N files_ or _N
 * seasons · N episodes_, and the **Details state**'s dot and words — and,
 * for a title whose Library folder can't be read, `folderLine`'s _Can’t be
 * reached right now_ in `danger`. Its words are `titleRowView`'s. No menus
 * yet: this phase is read-only.
 */

const DANGER = 'rgb(201, 122, 106)';

function renderRow(
  title: LibraryTitle,
  onClear: (title: LibraryTitle) => void = () => undefined,
  onDelete: (title: LibraryTitle) => void = () => undefined
) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <TitleRow title={title} onClear={onClear} onDelete={onDelete} />
        <p>somewhere else on the page</p>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('TitleRow — a film', () => {
  it('draws the title and its year', () => {
    renderRow(makeLibraryMovie({ title: 'Coco', year: 2017 }));

    expect(screen.getByText('Coco')).toBeDefined();
    expect(screen.getByText('2017')).toBeDefined();
  });

  it('draws no year when there is none', () => {
    renderRow(makeLibraryMovie({ title: 'Coco', year: null }));

    expect(screen.getByText('Coco')).toBeDefined();
    expect(screen.queryByText(/^\d{4}/)).toBeNull();
  });

  it('draws the path in mono', () => {
    renderRow(makeLibraryMovie({ path: 'E:\\Movies\\Coco (2017)' }));

    const path = screen.getByText('E:\\Movies\\Coco (2017)');
    expect(getComputedStyle(path).fontFamily).toContain('JetBrains Mono');
  });

  it('draws the folder glyph in the tile', () => {
    const { container } = renderRow(makeLibraryMovie());

    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('badges a copied film Copied', () => {
    renderRow(makeLibraryMovie({ linkedFiles: null }));

    expect(screen.getByText('Copied')).toBeDefined();
    expect(screen.queryByText('Linked')).toBeNull();
  });

  it('badges a linked film Linked', () => {
    renderRow(makeLibraryMovie({ linkedFiles: 'folder' }));

    expect(screen.getByText('Linked')).toBeDefined();
    expect(screen.queryByText('Copied')).toBeNull();
  });

  it('counts the film’s files', () => {
    renderRow(makeLibraryMovie({ files: 3 }));

    expect(screen.getByText('3 files')).toBeDefined();
  });

  it.each([
    ['synced', 'Synced with TMDB'],
    ['own', 'Your own details'],
    ['none', 'No details'],
  ] as const)('reads a %s title’s dot as %s', (details, words) => {
    renderRow(makeLibraryMovie({ details }));

    expect(screen.getByText(words)).toBeDefined();
  });

  it('draws no unreachable line for a reachable title', () => {
    renderRow(makeLibraryMovie({ linkedFiles: 'folder' }));

    expect(screen.queryByText(/^Can['’]t be reached right now$/)).toBeNull();
  });
});

describe('TitleRow — an unreachable title', () => {
  it('says it can’t be reached right now, in danger', () => {
    renderRow(makeLibraryMovie({ linkedFiles: 'unreachable' }));

    const line = screen.getByText('Can’t be reached right now');
    expect(getComputedStyle(line).color).toBe(DANGER);
  });

  it('keeps its path and its Linked badge', () => {
    renderRow(
      makeLibraryMovie({
        linkedFiles: 'unreachable',
        path: 'E:\\Movies\\Heat (1995)',
      })
    );

    expect(screen.getByText('E:\\Movies\\Heat (1995)')).toBeDefined();
    expect(screen.getByText('Linked')).toBeDefined();
  });
});

describe('TitleRow — a show', () => {
  it('draws its Year range', () => {
    renderRow(makeLibrarySeries({ year: 2019, endYear: 2023 }));

    expect(screen.getByText('2019–2023')).toBeDefined();
  });

  it('counts its seasons and episodes', () => {
    renderRow(makeLibrarySeries({ seasons: 3, episodes: 151 }));

    expect(screen.getByText('3 seasons · 151 episodes')).toBeDefined();
  });

  it('badges a show with linked episodes Linked', () => {
    renderRow(makeLibrarySeries({ linkedFiles: 'videos' }));

    expect(screen.getByText('Linked')).toBeDefined();
  });
});

/**
 * 47 — Manage library, Phase 2: "Edit details and Sync with TMDB" (issue
 * #408).
 *
 * Each Title row gains _Edit ▾_: a secondary sm `Button` with a trailing
 * chevron (`aria-hidden`, so the control is named _Edit_), the
 * `FilterDropdown` trigger's shape, over `Menu`. It holds two items, each with
 * its `hint` line: _Edit details_ (_Change the title, year and poster by
 * hand_) and _Sync with TMDB_ (_Fetch details and artwork again_). Where each
 * goes is asserted in `ManageLibrary`'s suite, under a router with a probe;
 * here, the menu itself — its items, and that it is keyboard-operable and
 * closes on Escape and an outside press, handing focus back.
 */

const EDIT_HINT = 'Change the title, year and poster by hand';
const SYNC_HINT = 'Fetch details and artwork again';

const editTrigger = () => screen.getByRole('button', { name: 'Edit' });
const editItem = () => screen.queryByRole('menuitem', { name: 'Edit details' });
const syncItem = () =>
  screen.queryByRole('menuitem', { name: 'Sync with TMDB' });

/** Opened the way a keyboard user opens it: focus the trigger, then act. */
function openEdit() {
  const control = editTrigger();
  control.focus();
  fireEvent.click(control);
  return control;
}

describe('TitleRow — Edit ▾', () => {
  it('draws Edit as a menu trigger, shut', () => {
    renderRow(makeLibraryMovie());

    const control = editTrigger();
    expect(control.getAttribute('aria-haspopup')).toBe('menu');
    expect(control.getAttribute('aria-expanded')).toBe('false');
    expect(editItem()).toBeNull();
  });

  it('draws a chevron on the trigger, kept out of its name', () => {
    renderRow(makeLibraryMovie());

    // The exact name is the assertion: "Edit", not "Edit ▾".
    expect(
      editTrigger().querySelector('svg, [aria-hidden="true"]')
    ).not.toBeNull();
  });

  it('opens on Edit details then Sync with TMDB, in that order', () => {
    renderRow(makeLibraryMovie());
    openEdit();

    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toBe(editItem());
    expect(items[1]).toBe(syncItem());
  });

  it('draws each item’s hint as its description', () => {
    renderRow(makeLibraryMovie());
    openEdit();

    expect(
      screen.getByRole('menuitem', {
        name: 'Edit details',
        description: EDIT_HINT,
      })
    ).toBeDefined();
    expect(
      screen.getByRole('menuitem', {
        name: 'Sync with TMDB',
        description: SYNC_HINT,
      })
    ).toBeDefined();
  });

  it('holds the same two items for a show', () => {
    renderRow(makeLibrarySeries());
    openEdit();

    expect(editItem()).not.toBeNull();
    expect(syncItem()).not.toBeNull();
  });
});

describe('TitleRow — Edit ▾ by keyboard', () => {
  it('puts focus on Edit details as it opens', () => {
    renderRow(makeLibraryMovie());
    openEdit();

    expect(document.activeElement).toBe(editItem());
  });

  it('walks to Sync with TMDB on ArrowDown, and wraps back', () => {
    renderRow(makeLibraryMovie());
    openEdit();

    fireEvent.keyDown(document.activeElement as HTMLElement, {
      key: 'ArrowDown',
    });
    expect(document.activeElement).toBe(syncItem());

    fireEvent.keyDown(document.activeElement as HTMLElement, {
      key: 'ArrowDown',
    });
    expect(document.activeElement).toBe(editItem());
  });

  it('closes on Escape and gives focus back to Edit', () => {
    renderRow(makeLibraryMovie());
    const control = openEdit();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(editItem()).toBeNull();
    expect(control.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(control);
  });

  it('closes on a press outside it and gives focus back to Edit', () => {
    renderRow(makeLibraryMovie());
    const control = openEdit();

    fireEvent.pointerDown(screen.getByText('somewhere else on the page'));

    expect(editItem()).toBeNull();
    expect(document.activeElement).toBe(control);
  });
});

/**
 * 47 — Manage library, Phase 3: "Clear details" (issue #409).
 *
 * Each Title row gains ⋯ after _Edit ▾_: a ghost `IconButton` with
 * `MoreIcon`, named _More actions for “Coco”_, over `Menu`. It holds _Clear
 * details_, disabled — `MenuItem`'s `disabled` — while the **Details state**
 * is `none`, since there is nothing to clear. A press hands the title to the
 * organism, which opens the **Clear dialog**.
 */

const moreTrigger = (title = 'Coco') =>
  screen.getByRole('button', { name: `More actions for “${title}”` });
const clearItem = () => screen.getByRole('menuitem', { name: 'Clear details' });

function openMore(title = 'Coco') {
  const control = moreTrigger(title);
  control.focus();
  fireEvent.click(control);
  return control;
}

describe('TitleRow — ⋯', () => {
  it('draws ⋯ as a menu trigger named for the title, shut', () => {
    renderRow(makeLibraryMovie({ title: 'Coco' }));

    const control = moreTrigger();
    expect(control.getAttribute('aria-haspopup')).toBe('menu');
    expect(control.getAttribute('aria-expanded')).toBe('false');
    expect(
      screen.queryByRole('menuitem', { name: 'Clear details' })
    ).toBeNull();
  });

  it('draws the more glyph on it', () => {
    renderRow(makeLibraryMovie({ title: 'Coco' }));

    expect(moreTrigger().querySelector('svg')).not.toBeNull();
  });

  it('draws ⋯ after Edit', () => {
    renderRow(makeLibraryMovie({ title: 'Coco' }));

    const edit = editTrigger();
    const more = moreTrigger();
    expect(
      edit.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('names a show’s ⋯ for the show', () => {
    renderRow(makeLibrarySeries({ title: 'Bluey' }));

    expect(moreTrigger('Bluey')).toBeDefined();
  });

  it('opens on Clear details', () => {
    renderRow(makeLibraryMovie({ title: 'Coco', details: 'synced' }));
    openMore();

    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent)
    ).toContain('Clear details');
    expect(clearItem()).toBeDefined();
  });

  it.each(['synced', 'own'] as const)(
    'hands the title over on Clear details at %s',
    (details) => {
      const onClear = vi.fn();
      const title = makeLibraryMovie({ title: 'Coco', details });
      renderRow(title, onClear);
      const control = openMore();

      fireEvent.click(clearItem());

      expect(onClear).toHaveBeenCalledWith(title);
      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(control);
    }
  );

  it('leaves Clear details live at synced and own', () => {
    renderRow(makeLibraryMovie({ title: 'Coco', details: 'own' }));
    openMore();

    expect(clearItem().getAttribute('aria-disabled')).toBeNull();
  });

  it('disables Clear details at none', () => {
    renderRow(makeLibraryMovie({ title: 'Coco', details: 'none' }));
    openMore();

    expect(clearItem().getAttribute('aria-disabled')).toBe('true');
  });

  it('hands nothing over on a press of a disabled Clear details', () => {
    const onClear = vi.fn();
    renderRow(makeLibraryMovie({ title: 'Coco', details: 'none' }), onClear);
    openMore();

    fireEvent.click(clearItem());

    expect(onClear).not.toHaveBeenCalled();
  });

  it('disables a show’s Clear details at none too', () => {
    renderRow(makeLibrarySeries({ title: 'Bluey', details: 'none' }));
    openMore('Bluey');

    expect(clearItem().getAttribute('aria-disabled')).toBe('true');
  });
});

/**
 * 47 — Manage library, Phase 4: "delete a copied title" (issue #410).
 *
 * The ⋯ menu gains _Delete…_ as its **Danger row** — danger ink, after
 * _Clear details_ and below a divider (`role="separator"`). A press hands the
 * title to the organism, which opens the **Delete dialog**. Since issue
 * #411, _Delete…_ is offered on every row, linked titles included.
 */

const deleteItem = () => screen.queryByRole('menuitem', { name: 'Delete…' });

describe('TitleRow — Delete…', () => {
  it('offers Delete… after Clear details, below a divider', () => {
    renderRow(makeLibraryMovie({ title: 'Coco', linkedFiles: null }));
    openMore();

    const menu = screen.getByRole('menu');
    const divider = within(menu).getByRole('separator');
    const remove = deleteItem();
    expect(remove).not.toBeNull();
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent)
    ).toEqual(['Clear details', 'Delete…']);
    expect(comesBefore(clearItem(), divider)).toBe(true);
    expect(comesBefore(divider, remove as HTMLElement)).toBe(true);
  });

  it('draws Delete… as the danger row', () => {
    renderRow(makeLibraryMovie({ title: 'Coco' }));
    openMore();

    expect(getComputedStyle(deleteItem() as HTMLElement).color).toBe(DANGER);
  });

  it('hands a copied film over on Delete…, and shuts the menu', () => {
    const onDelete = vi.fn();
    const onClear = vi.fn();
    const title = makeLibraryMovie({ title: 'Coco' });
    renderRow(title, onClear, onDelete);
    const control = openMore();

    fireEvent.click(deleteItem() as HTMLElement);

    expect(onDelete).toHaveBeenCalledWith(title);
    expect(onClear).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(control);
  });

  it('hands a copied show over on Delete…', () => {
    const onDelete = vi.fn();
    const title = makeLibrarySeries({ title: 'Bluey' });
    renderRow(title, undefined, onDelete);
    openMore('Bluey');

    fireEvent.click(deleteItem() as HTMLElement);

    expect(onDelete).toHaveBeenCalledWith(title);
  });

  it('leaves Delete… live at none, where Clear details is not', () => {
    renderRow(makeLibraryMovie({ title: 'Coco', details: 'none' }));
    openMore();

    expect(deleteItem()?.getAttribute('aria-disabled')).toBeNull();
  });

  it.each(['folder', 'videos', 'unreachable'] as const)(
    'offers Delete… for a linked title too (%s), and hands it over',
    (linkedFiles) => {
      const onDelete = vi.fn();
      const title = makeLibraryMovie({ title: 'Coco', linkedFiles });
      renderRow(title, undefined, onDelete);
      openMore();

      expect(
        screen.getAllByRole('menuitem').map((item) => item.textContent)
      ).toEqual(['Clear details', 'Delete…']);
      fireEvent.click(deleteItem() as HTMLElement);
      expect(onDelete).toHaveBeenCalledWith(title);
    }
  );
});
