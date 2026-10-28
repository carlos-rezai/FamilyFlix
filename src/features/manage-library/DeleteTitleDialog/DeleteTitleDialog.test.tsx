import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { DeleteTitleDialog } from './DeleteTitleDialog';
import type { BusyPhase, LibraryTitle } from '@/types';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import {
  makeLibraryMovie,
  makeLibrarySeries,
} from '@/test-support/makeLibraryTitle/makeLibraryTitle';

/**
 * 47 — Manage library, Phase 4: "delete a copied title" (issue #410).
 *
 * The **Delete dialog** for a copied title, on `Modal` in the **Reset
 * dialog**'s shape (log 47 Q12): _Delete “Coco”?_, the sentence _This takes
 * the movie out of FamilyFlix. It can’t be undone from here._, the title's
 * path in the mono well, **What goes** (_Its details, poster and artwork_;
 * _Its watch history, rating and heart_; _FamilyFlix’s copy of its video and
 * subtitles_) beside **What stays** (_Your original in its library folder —
 * Scan folders would bring it back_ when there is an original, else
 * _Nothing_), then _Delete movie_ / _Delete series_ in `danger` —
 * busy on its label and **Locked** from the press, the **Dialog loader**
 * once **Shown** (53, issue #488), before _Cancel_. Focus
 * lands on the card, so Enter alone deletes nothing.
 *
 * Presentational over its props: the organism owns the request.
 */

const DANGER = 'rgb(201, 122, 106)';
const GOES = [
  'Its details, poster and artwork',
  'Its watch history, rating and heart',
  'FamilyFlix’s copy of its video and subtitles',
];
const ORIGINAL_STAYS = [
  'Your original in its library folder — Scan folders would bring it back',
];

const COCO = makeLibraryMovie({
  id: 'm1',
  title: 'Coco',
  path: 'C:\\FamilyFlix\\media\\coco-2017',
  originalPath: 'E:\\Movies\\Coco (2017)',
});

function renderDialog({
  title = COCO,
  deleting = 'idle',
  failed = false,
  onConfirm = () => undefined,
  onClose = () => undefined,
}: {
  title?: LibraryTitle;
  deleting?: BusyPhase;
  failed?: boolean;
  onConfirm?: () => void;
  onClose?: () => void;
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <DeleteTitleDialog
        title={title}
        deleting={deleting}
        failed={failed}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    </ThemeProvider>
  );
}

const dialog = (name = 'Delete “Coco”?') =>
  screen.getByRole('dialog', { name });
const scrim = () => dialog().parentElement as HTMLElement;
const confirm = () => screen.getByRole('button', { name: /^Delet/ });
const cancel = () => screen.getByRole('button', { name: 'Cancel' });

/** The list under a heading: the first `ul` that follows it. */
function listUnder(heading: string, name?: string): HTMLElement {
  const label = within(dialog(name)).getByText(heading);
  const lists = within(dialog(name)).getAllByRole('list');
  const list = lists.find((candidate) => comesBefore(label, candidate));
  if (!list) {
    throw new Error(`no list under ${heading}`);
  }
  return list;
}

const itemsOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('DeleteTitleDialog — the copy', () => {
  it('is titled Delete “Coco”?', () => {
    renderDialog();

    expect(
      within(dialog()).getByRole('heading', { name: 'Delete “Coco”?' })
    ).toBeDefined();
  });

  it('says the movie leaves FamilyFlix and can’t be undone from here', () => {
    renderDialog();

    expect(
      within(dialog()).getByText(
        'This takes the movie out of FamilyFlix. It can’t be undone from here.'
      )
    ).toBeDefined();
  });

  it('names the show and says the series, for a show', () => {
    renderDialog({ title: makeLibrarySeries({ title: 'Bluey' }) });

    const card = dialog('Delete “Bluey”?');
    expect(
      within(card).getByText(
        'This takes the series out of FamilyFlix. It can’t be undone from here.'
      )
    ).toBeDefined();
  });
});

describe('DeleteTitleDialog — the path', () => {
  it('draws the title’s path in mono, above the lists', () => {
    renderDialog();

    const path = within(dialog()).getByText('C:\\FamilyFlix\\media\\coco-2017');
    expect(getComputedStyle(path).fontFamily).toContain('JetBrains Mono');
    expect(comesBefore(path, listUnder('What goes'))).toBe(true);
  });
});

describe('DeleteTitleDialog — the lists, with an original', () => {
  it('lists What goes, in the log’s copy and order', () => {
    renderDialog();

    expect(itemsOf(listUnder('What goes'))).toEqual(GOES);
  });

  it('lists What stays after it: the original, which a scan would bring back', () => {
    renderDialog();

    const goes = listUnder('What goes');
    const stays = listUnder('What stays');
    expect(stays).not.toBe(goes);
    expect(comesBefore(goes, stays)).toBe(true);
    expect(itemsOf(stays)).toEqual(ORIGINAL_STAYS);
  });

  it('lists the same for a copied show with an original', () => {
    renderDialog({
      title: makeLibrarySeries({
        title: 'Bluey',
        originalPath: 'E:\\Series\\Bluey',
      }),
    });

    expect(itemsOf(listUnder('What goes', 'Delete “Bluey”?'))).toEqual(GOES);
    expect(itemsOf(listUnder('What stays', 'Delete “Bluey”?'))).toEqual(
      ORIGINAL_STAYS
    );
  });
});

describe('DeleteTitleDialog — the lists, without an original', () => {
  const HAND_ADDED = makeLibraryMovie({ title: 'Coco', originalPath: null });

  it('lists the same What goes', () => {
    renderDialog({ title: HAND_ADDED });

    expect(itemsOf(listUnder('What goes'))).toEqual(GOES);
  });

  it('keeps Nothing', () => {
    renderDialog({ title: HAND_ADDED });

    expect(itemsOf(listUnder('What stays'))).toEqual(['Nothing']);
    expect(within(dialog()).queryByText(/Scan folders/)).toBeNull();
  });
});

describe('DeleteTitleDialog — the buttons', () => {
  it('draws Delete movie in danger before Cancel, after the lists', () => {
    renderDialog();

    expect(confirm().textContent).toBe('Delete movie');
    expect(getComputedStyle(confirm()).color).toBe(DANGER);
    expect(comesBefore(confirm(), cancel())).toBe(true);
    expect(comesBefore(listUnder('What stays'), confirm())).toBe(true);
  });

  it('draws Delete series for a show', () => {
    renderDialog({ title: makeLibrarySeries({ title: 'Bluey' }) });

    expect(confirm().textContent).toBe('Delete series');
  });

  it('confirms on Delete movie', () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    fireEvent.click(confirm());

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('is busy on its idle label and inert, Cancel disabled, while waiting', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    renderDialog({ deleting: 'waiting', onConfirm, onClose });

    expect(confirm().textContent).toBe('Delete movie');
    expect(confirm().getAttribute('aria-busy')).toBe('true');
    expect((confirm() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm());
    expect(onConfirm).not.toHaveBeenCalled();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect((cancel as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(cancel);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('becomes the dialog loader reading Deleting “Coco” once shown', () => {
    renderDialog({ deleting: 'shown' });

    expect(
      screen.getByRole('status', { name: 'Deleting “Coco”' })
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('draws the failure line above the buttons once a delete failed', () => {
    renderDialog({ failed: true });

    expect(
      screen.getByText('Couldn’t delete “Coco”. Try again.')
    ).toBeDefined();
  });
});

describe('DeleteTitleDialog — the ways out', () => {
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

describe('DeleteTitleDialog — focus', () => {
  it('lands on the card, not a button', () => {
    renderDialog();

    expect(document.activeElement).toBe(dialog());
  });

  it('deletes nothing on Enter alone', () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Enter',
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });
});

/**
 * 47 — Manage library, Phase 5: "delete a linked title" (issue #411), as
 * 52, Keep originals, Phase 4 (issue #477) leaves it.
 *
 * A Delete keeps originals: a linked title's What goes is its details and
 * history, What stays its files where they lie; an `unreachable` title keeps
 * _Its files on <path> — they can’t be reached right now_. It is one dialog
 * everywhere: in the shell (a **Folder bridge** present) it draws exactly
 * what a browser draws, with no choice of the files.
 */
const SHARED_GOES = GOES.slice(0, 2);

describe('DeleteTitleDialog — an unreachable title', () => {
  const GONE = makeLibraryMovie({
    title: 'Coco',
    linkedFiles: 'unreachable',
    path: 'F:\\Movies\\Coco (2017)',
  });

  it('keeps the files on their path, which can’t be reached', () => {
    renderDialog({ title: GONE });

    expect(itemsOf(listUnder('What goes'))).toEqual(SHARED_GOES);
    expect(itemsOf(listUnder('What stays'))).toEqual([
      'Its files on F:\\Movies\\Coco (2017) — they can’t be reached right now',
    ]);
  });
});

const LINKED = [
  {
    linkedFiles: 'folder',
    path: 'E:\\Movies\\Coco (2017)',
    stays: 'Its folder, in your library folder',
  },
  {
    linkedFiles: 'videos',
    path: 'E:\\Movies\\Collection\\Coco.mkv',
    stays: 'Its video file(s), in your library folder',
  },
] as const;

describe('DeleteTitleDialog: a linked title, in the shell', () => {
  fakeFolderBridge();

  it.each(LINKED)(
    'draws no choice for $linkedFiles, its files kept',
    ({ linkedFiles, path, stays }) => {
      renderDialog({
        title: makeLibraryMovie({ title: 'Coco', linkedFiles, path }),
      });

      expect(within(dialog()).queryAllByRole('radio')).toEqual([]);
      expect(itemsOf(listUnder('What goes'))).toEqual(SHARED_GOES);
      expect(itemsOf(listUnder('What stays'))).toEqual([stays]);
    }
  );

  it('confirms, drawing no choice of the files', () => {
    const onConfirm = vi.fn();
    renderDialog({
      title: makeLibraryMovie({ title: 'Coco', linkedFiles: 'folder' }),
      onConfirm,
    });
    expect(within(dialog()).queryAllByRole('radio')).toEqual([]);

    fireEvent.click(confirm());

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
