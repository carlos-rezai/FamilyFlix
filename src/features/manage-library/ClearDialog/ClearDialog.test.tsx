import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { ClearDialog } from './ClearDialog';
import type { BusyPhase, LibraryTitle } from '@/types';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import {
  makeLibraryMovie,
  makeLibrarySeries,
} from '@/test-support/makeLibraryTitle/makeLibraryTitle';

/**
 * 47 — Manage library, Phase 3: "Clear details" (issue #409).
 *
 * The **Clear dialog**, on `Modal` in the **Reset dialog**'s shape (log 47
 * Q13): the accent tile, _Clear details?_, the sentence — _The movie stays in
 * your library under its title, with no details, until you edit it or sync it
 * with TMDB._, a show's _The series stays …_ — the title's path in the mono
 * well, **What goes** (_Year, synopsis, credits and genres_; _Poster, backdrop
 * and artwork_; _Its TMDB match and score_), **What stays** (_Its title and
 * files_; _Watch history, rating and heart_), then _Clear details_ —
 * locked from the press, _Clearing…_ once shown — before _Cancel_. Focus lands
 * on the card, so Enter alone clears nothing.
 *
 * Presentational over its props: the organism owns the request, so a confirm
 * is a call of `onConfirm` and nothing on the wire.
 */

const TITLE = 'Clear details?';
const WHAT_GOES = [
  'Year, synopsis, credits and genres',
  'Poster, backdrop and artwork',
  'Its TMDB match and score',
];
const WHAT_STAYS = ['Its title and files', 'Watch history, rating and heart'];

const COCO = makeLibraryMovie({
  id: 'm1',
  title: 'Coco',
  path: 'E:\\Movies\\Coco (2017)',
  details: 'synced',
});

function renderDialog({
  title = COCO,
  clearing = 'idle',
  onConfirm = () => undefined,
  onClose = () => undefined,
}: {
  title?: LibraryTitle;
  clearing?: BusyPhase;
  onConfirm?: () => void;
  onClose?: () => void;
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <ClearDialog
        title={title}
        clearing={clearing}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    </ThemeProvider>
  );
}

const dialog = () => screen.getByRole('dialog', { name: TITLE });
const scrim = () => dialog().parentElement as HTMLElement;
const confirm = () => screen.getByRole('button', { name: /^Clear/ });
const cancel = () => screen.getByRole('button', { name: 'Cancel' });

/** The list under a heading: the `ul` that follows it. */
function listUnder(heading: string): HTMLElement {
  const label = within(dialog()).getByText(heading);
  const lists = within(dialog()).getAllByRole('list');
  const list = lists.find((candidate) => comesBefore(label, candidate));
  if (!list) {
    throw new Error(`no list under ${heading}`);
  }
  return list;
}

describe('ClearDialog — the copy', () => {
  it('is titled Clear details?', () => {
    renderDialog();

    expect(
      within(dialog()).getByRole('heading', { name: TITLE })
    ).toBeDefined();
  });

  it('says the movie stays, under its title, until it is edited or synced', () => {
    renderDialog();

    expect(
      within(dialog()).getByText(
        'The movie stays in your library under its title, with no details, until you edit it or sync it with TMDB.'
      )
    ).toBeDefined();
  });

  it('says the series stays, for a show', () => {
    renderDialog({ title: makeLibrarySeries({ title: 'Bluey' }) });

    expect(
      within(dialog()).getByText(
        'The series stays in your library under its title, with no details, until you edit it or sync it with TMDB.'
      )
    ).toBeDefined();
  });

  it('draws the accent tile’s glyph, decorative', () => {
    renderDialog();

    const glyph = dialog().querySelector('svg');
    expect(glyph).not.toBeNull();
    expect(glyph?.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('ClearDialog — the path', () => {
  it('draws the title’s path in mono', () => {
    renderDialog();

    const path = within(dialog()).getByText('E:\\Movies\\Coco (2017)');
    expect(getComputedStyle(path).fontFamily).toContain('JetBrains Mono');
  });

  it('draws the path above the lists', () => {
    renderDialog();

    const path = within(dialog()).getByText('E:\\Movies\\Coco (2017)');
    expect(comesBefore(path, listUnder('What goes'))).toBe(true);
  });
});

describe('ClearDialog — the lists', () => {
  it('lists What goes, in the log’s copy and order', () => {
    renderDialog();

    const items = within(listUnder('What goes')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(WHAT_GOES);
  });

  it('lists What stays after it, in the log’s copy and order', () => {
    renderDialog();

    const goes = listUnder('What goes');
    const stays = listUnder('What stays');
    expect(stays).not.toBe(goes);
    expect(comesBefore(goes, stays)).toBe(true);
    const items = within(stays).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(WHAT_STAYS);
  });

  it('draws the same lists for a show', () => {
    renderDialog({ title: makeLibrarySeries({ title: 'Bluey' }) });

    expect(
      within(listUnder('What goes'))
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual(WHAT_GOES);
    expect(
      within(listUnder('What stays'))
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual(WHAT_STAYS);
  });
});

describe('ClearDialog — the buttons', () => {
  it('draws Clear details before Cancel, after the lists', () => {
    renderDialog();

    expect(confirm().textContent).toBe('Clear details');
    expect(comesBefore(confirm(), cancel())).toBe(true);
    expect(comesBefore(listUnder('What stays'), confirm())).toBe(true);
  });

  it('confirms on Clear details', () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    fireEvent.click(confirm());

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('is inert on its idle label while the clear is waiting', () => {
    const onConfirm = vi.fn();
    renderDialog({ clearing: 'waiting', onConfirm });

    expect(confirm().textContent).toBe('Clear details');
    expect((confirm() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('reads Clearing… and is inert once the loader is shown', () => {
    const onConfirm = vi.fn();
    renderDialog({ clearing: 'shown', onConfirm });

    expect(confirm().textContent).toBe('Clearing…');
    expect((confirm() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm());
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('ClearDialog — the ways out', () => {
  it.each([
    ['Cancel', () => fireEvent.click(cancel())],
    [
      'the ✕',
      () => fireEvent.click(screen.getByRole('button', { name: 'Close' })),
    ],
    ['Escape', () => fireEvent.keyDown(dialog(), { key: 'Escape' })],
    ['the scrim', () => fireEvent.click(scrim())],
  ])('closes from %s, confirming nothing', (_way, leave) => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    renderDialog({ onClose, onConfirm });

    leave();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('ClearDialog — focus', () => {
  it('lands on the card, not a button', () => {
    renderDialog();

    expect(document.activeElement).toBe(dialog());
  });

  it('clears nothing on Enter alone', () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Enter',
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
