import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { DeleteTitleDialog } from './DeleteTitleDialog';
import type { DeleteFiles, LibraryTitle } from '@/types';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import {
  makeLibraryMovie,
  makeLibrarySeries,
} from '@/test-support/makeLibraryTitle/makeLibraryTitle';

/**
 * 51 — Library audit, Phase 9: "the Recycle choice in the Delete dialog"
 * (issue #452, log 51 Q6).
 *
 * For a linked title in the shell whose **Linked files** aren't `shared`, the
 * dialog draws the **Recycle choice** between **What goes / What stays** and
 * the buttons: two `ChoiceCard`s in a radiogroup named _Its files_, **Keep
 * the files** (chosen on every open) and **Move them to the Recycle Bin**.
 * Keeping lists the files under What stays (_Its folder, in your library
 * folder_), with no callout; the second card moves them to What goes (_Its
 * folder, to the Recycle Bin_), keeps _Nothing_ and draws the callout. The
 * confirm's words never change, and the confirm hands the choice to the
 * organism: `'trash'` only on the second card, else `'keep'`.
 *
 * A `shared` title draws no cards, and What stays reads _Its video file(s),
 * which another title plays_. A copied title, an unreachable one and a
 * browser (no **Desktop shell**, so no `window.familyflix.folders`) draw no
 * cards; a browser's linked title keeps its files.
 */

const SHARED_GOES = [
  'Its details, poster and artwork',
  'Its watch history, rating and heart',
];
const CALLOUT =
  'This is a linked title. Its files go from your library folder to the Recycle Bin, not just out of FamilyFlix.';
const KEEP = 'Keep the files';
const KEEP_LINE =
  'They stay in your library folder. A scan won’t add it again.';
const TRASH = 'Move them to the Recycle Bin';
const TRASH_LINE =
  'From your library folder, so it can be restored from there.';
const SHARED_STAYS = 'Its video file(s), which another title plays';

const COCO = makeLibraryMovie({
  id: 'm1',
  title: 'Coco',
  linkedFiles: 'folder',
  path: 'E:\\Movies\\Coco (2017)',
});
const HEAT = makeLibraryMovie({
  id: 'm2',
  title: 'Coco',
  linkedFiles: 'videos',
  path: 'E:\\Movies\\Collection\\Coco.mkv',
});
const SHARED = makeLibraryMovie({
  id: 'm3',
  title: 'Coco',
  linkedFiles: 'shared',
  path: 'E:\\Movies\\Collection\\Coco.mkv',
});

function renderDialog({
  title = COCO,
  onConfirm = () => undefined,
}: {
  title?: LibraryTitle;
  onConfirm?: (files: DeleteFiles) => void;
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <DeleteTitleDialog
        title={title}
        deleting={false}
        refusal={null}
        onConfirm={onConfirm}
        onClose={() => undefined}
      />
    </ThemeProvider>
  );
}

const dialog = () => screen.getByRole('dialog', { name: 'Delete “Coco”?' });
const choice = () => within(dialog()).queryByRole('radiogroup');
const card = (label: string) =>
  within(dialog()).getByRole('radio', { name: new RegExp(`^${label}`) });
const confirm = () =>
  within(dialog()).getByRole('button', { name: /^Delete (movie|series)$/ });

/** The list under a heading: the first `ul` that follows it. */
function listUnder(heading: string): HTMLElement {
  const label = within(dialog()).getByText(heading);
  const list = within(dialog())
    .getAllByRole('list')
    .find((candidate) => comesBefore(label, candidate));
  if (!list) {
    throw new Error(`no list under ${heading}`);
  }
  return list;
}

const itemsOf = (heading: string) =>
  within(listUnder(heading))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('DeleteTitleDialog — the Recycle choice, in the shell', () => {
  fakeFolderBridge();

  it.each([
    ['folder', COCO],
    ['videos', HEAT],
  ] as const)(
    'draws the two cards for linked %s, in a radiogroup named Its files',
    (_files, title) => {
      renderDialog({ title });

      const group = within(dialog()).getByRole('radiogroup', {
        name: 'Its files',
      });
      const radios = within(group).getAllByRole('radio');
      expect(radios).toHaveLength(2);
      expect(radios[0].textContent).toContain(KEEP);
      expect(radios[0].textContent).toContain(KEEP_LINE);
      expect(radios[1].textContent).toContain(TRASH);
      expect(radios[1].textContent).toContain(TRASH_LINE);
    }
  );

  it('draws the cards between What stays and the buttons', () => {
    renderDialog();

    const group = within(dialog()).getByRole('radiogroup', {
      name: 'Its files',
    });
    expect(comesBefore(within(dialog()).getByText('What stays'), group)).toBe(
      true
    );
    expect(comesBefore(group, confirm())).toBe(true);
  });

  it('chooses Keep the files on open', () => {
    renderDialog();

    expect(card(KEEP).getAttribute('aria-checked')).toBe('true');
    expect(card(TRASH).getAttribute('aria-checked')).toBe('false');
  });

  it('chooses Keep the files again on the next open, after a Recycle Bin pick', () => {
    const first = renderDialog();
    fireEvent.click(card(TRASH));
    expect(card(TRASH).getAttribute('aria-checked')).toBe('true');
    first.unmount();

    renderDialog();

    expect(card(KEEP).getAttribute('aria-checked')).toBe('true');
    expect(card(TRASH).getAttribute('aria-checked')).toBe('false');
  });

  it('keeps a folder under What stays, with no callout, on Keep the files', () => {
    renderDialog();

    expect(itemsOf('What goes')).toEqual(SHARED_GOES);
    expect(itemsOf('What stays')).toEqual([
      'Its folder, in your library folder',
    ]);
    expect(within(dialog()).queryByText(CALLOUT)).toBeNull();
  });

  it('keeps video file(s) under What stays on Keep the files', () => {
    renderDialog({ title: HEAT });

    expect(itemsOf('What goes')).toEqual(SHARED_GOES);
    expect(itemsOf('What stays')).toEqual([
      'Its video file(s), in your library folder',
    ]);
  });

  it('moves the folder to What goes, keeps Nothing and draws the callout on the Recycle Bin card', () => {
    renderDialog();

    fireEvent.click(card(TRASH));

    expect(itemsOf('What goes')).toEqual([
      ...SHARED_GOES,
      'Its folder, to the Recycle Bin',
    ]);
    expect(itemsOf('What stays')).toEqual(['Nothing']);
    expect(within(dialog()).getByText(CALLOUT)).toBeDefined();
  });

  it('moves video file(s) to What goes on the Recycle Bin card', () => {
    renderDialog({ title: HEAT });

    fireEvent.click(card(TRASH));

    expect(itemsOf('What goes')).toEqual([
      ...SHARED_GOES,
      'Its video file(s), to the Recycle Bin',
    ]);
    expect(itemsOf('What stays')).toEqual(['Nothing']);
    expect(within(dialog()).getByText(CALLOUT)).toBeDefined();
  });

  it('puts the files back under What stays when Keep the files is chosen again', () => {
    renderDialog();
    fireEvent.click(card(TRASH));

    fireEvent.click(card(KEEP));

    expect(card(KEEP).getAttribute('aria-checked')).toBe('true');
    expect(itemsOf('What stays')).toEqual([
      'Its folder, in your library folder',
    ]);
    expect(within(dialog()).queryByText(CALLOUT)).toBeNull();
  });

  it('never changes the confirm’s words', () => {
    renderDialog();
    expect(confirm().textContent).toBe('Delete movie');

    fireEvent.click(card(TRASH));

    expect(confirm().textContent).toBe('Delete movie');
  });

  it('keeps the series’ confirm words on both cards', () => {
    renderDialog({
      title: makeLibrarySeries({
        title: 'Coco',
        linkedFiles: 'folder',
        path: 'E:\\Series\\Coco',
      }),
    });
    expect(confirm().textContent).toBe('Delete series');

    fireEvent.click(card(TRASH));

    expect(confirm().textContent).toBe('Delete series');
  });

  it('confirms with keep on Keep the files', () => {
    const onConfirm = vi.fn<(files: DeleteFiles) => void>();
    renderDialog({ onConfirm });

    fireEvent.click(confirm());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('keep');
  });

  it('confirms with trash only on the Recycle Bin card', () => {
    const onConfirm = vi.fn<(files: DeleteFiles) => void>();
    renderDialog({ onConfirm });

    fireEvent.click(card(TRASH));
    fireEvent.click(confirm());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('trash');
  });

  it('confirms with keep after going back to Keep the files', () => {
    const onConfirm = vi.fn<(files: DeleteFiles) => void>();
    renderDialog({ onConfirm });

    fireEvent.click(card(TRASH));
    fireEvent.click(card(KEEP));
    fireEvent.click(confirm());

    expect(onConfirm).toHaveBeenCalledWith('keep');
  });
});

describe('DeleteTitleDialog — a shared title, in the shell', () => {
  fakeFolderBridge();

  it('draws no cards, and reads that another title plays its video file(s)', () => {
    renderDialog({ title: SHARED });

    expect(choice()).toBeNull();
    expect(within(dialog()).queryAllByRole('radio')).toEqual([]);
    expect(itemsOf('What stays')).toEqual([SHARED_STAYS]);
  });

  it('lists only its details and history in What goes, with no callout', () => {
    renderDialog({ title: SHARED });

    expect(itemsOf('What goes')).toEqual(SHARED_GOES);
    expect(itemsOf('What stays')).toEqual([SHARED_STAYS]);
    expect(within(dialog()).queryByText(CALLOUT)).toBeNull();
  });

  it('confirms with keep', () => {
    const onConfirm = vi.fn<(files: DeleteFiles) => void>();
    renderDialog({ title: SHARED, onConfirm });

    fireEvent.click(confirm());

    expect(onConfirm).toHaveBeenCalledWith('keep');
  });
});

describe('DeleteTitleDialog — no Recycle choice for a copied or unreachable title', () => {
  fakeFolderBridge();

  it.each([
    ['a copied', null],
    ['an unreachable', 'unreachable'],
  ] as const)(
    'draws no cards for %s title, and confirms with keep',
    (_kind, linkedFiles) => {
      const onConfirm = vi.fn<(files: DeleteFiles) => void>();
      renderDialog({
        title: makeLibraryMovie({ title: 'Coco', linkedFiles }),
        onConfirm,
      });

      expect(choice()).toBeNull();
      fireEvent.click(confirm());
      expect(onConfirm).toHaveBeenCalledWith('keep');
    }
  );
});

describe('DeleteTitleDialog — the Recycle choice, in a browser', () => {
  it('draws no cards for a linked title, and keeps its files', () => {
    renderDialog();

    expect(choice()).toBeNull();
    expect(within(dialog()).queryAllByRole('radio')).toEqual([]);
    expect(itemsOf('What stays')).toEqual([
      'Its folder, in your library folder',
    ]);
  });

  it('lists only its details and history in What goes, with no callout', () => {
    renderDialog();

    expect(itemsOf('What goes')).toEqual(SHARED_GOES);
    expect(itemsOf('What stays')).toEqual([
      'Its folder, in your library folder',
    ]);
    expect(within(dialog()).queryByText(CALLOUT)).toBeNull();
  });

  it('confirms a linked title’s delete with keep', () => {
    const onConfirm = vi.fn<(files: DeleteFiles) => void>();
    renderDialog({ onConfirm });

    fireEvent.click(confirm());

    expect(onConfirm).toHaveBeenCalledWith('keep');
  });

  it('reads the shared wording for a shared title', () => {
    renderDialog({ title: SHARED });

    expect(itemsOf('What stays')).toEqual([SHARED_STAYS]);
  });
});
