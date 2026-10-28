import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ManageLibrary } from './ManageLibrary';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import type { LibraryTitles } from '@/types';
import { theme } from '@/styles/theme';
import {
  noContentResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { makeLibraryMovie } from '@/test-support/makeLibraryTitle/makeLibraryTitle';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';

/**
 * 53 — Loading states, Phase 6 (issue #488): Manage library's **Delete
 * dialog** in the **Reset dialog**'s shape.
 *
 * From the confirm press the dialog is **Locked** and _Cancel_ disabled, in
 * `waiting` too; once the delete has run 300ms it becomes the **Dialog
 * loader** reading _Deleting “Coco”_, saying nothing about files. A delete
 * that lands closes it, the row off the list, with the notice, only after
 * the 500ms hold; a failed one returns the live idle face with _Couldn’t
 * delete “Coco”. Try again._, cleared by the next confirm.
 *
 * The list is read on real timers; the clock is faked from the press on.
 */

const LIBRARY: LibraryTitles = {
  movies: [
    makeLibraryMovie({ id: 'm1', title: 'Coco' }),
    makeLibraryMovie({
      id: 'm2',
      title: 'Heat',
      linkedFiles: 'folder',
      path: 'E:\\Movies\\Heat (1995)',
    }),
  ],
  series: [],
};

const { respond } = heldFetch((url) =>
  url === '/api/library-titles' ? okResponse(LIBRARY) : undefined
);

afterEach(() => {
  vi.useRealTimers();
});

const NOTICE = '“Coco” was deleted.';
const FAILED = 'Couldn’t delete “Coco”. Try again.';

/** The page with the list landed and the Delete dialog open over `title`. */
async function openDeleteOn(title = 'Coco') {
  const history = ['/', '/settings', '/settings/library'];
  render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <Routes>
            <Route path="/settings/library" element={<ManageLibrary />} />
          </Routes>
        </SnackbarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: /^Movies/ })).not.toBeNull()
  );
  const more = screen.getByRole('button', {
    name: `More actions for “${title}”`,
  });
  more.focus();
  fireEvent.click(more);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }));
}

const dialog = (title = 'Coco') =>
  screen.queryByRole('dialog', { name: `Delete “${title}”?` });
const liveDialog = (title = 'Coco') => dialog(title) as HTMLElement;
const confirm = (title = 'Coco') =>
  within(liveDialog(title)).getByRole('button', {
    name: /^Delet/,
  }) as HTMLButtonElement;
const cancel = (title = 'Coco') =>
  within(liveDialog(title)).getByRole('button', {
    name: 'Cancel',
  }) as HTMLButtonElement;
const loader = (title = 'Coco') =>
  screen.queryByRole('status', { name: `Deleting “${title}”` });

/** Press the confirm on a faked clock. */
function pressDelete(title = 'Coco') {
  vi.useFakeTimers();
  fireEvent.click(confirm(title));
}

/** A delete pressed, shown, failed, and its hold run out. */
async function failOnce() {
  pressDelete();
  await advanceClock(300);
  await respond(serverErrorResponse());
  await advanceClock(500);
}

describe('ManageLibrary — the Delete dialog, locked from the confirm press', () => {
  it('locks at once, while waiting: no ✕, Cancel disabled, the confirm busy on its idle label', async () => {
    await openDeleteOn();
    pressDelete();

    expect(confirm().disabled).toBe(true);
    expect(confirm().getAttribute('aria-busy')).toBe('true');
    expect(confirm().textContent).toBe('Delete movie');
    expect(cancel().disabled).toBe(true);
    expect(
      within(liveDialog()).queryByRole('button', { name: 'Close' })
    ).toBeNull();

    fireEvent.click(cancel());
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    fireEvent.click(liveDialog().parentElement as HTMLElement);
    expect(dialog()).not.toBeNull();

    await respond(noContentResponse());
    await advanceClock(500);
  });

  it('becomes the dialog loader reading Deleting “Coco” at 300ms, still locked', async () => {
    await openDeleteOn();
    pressDelete();

    await advanceClock(299);
    expect(loader()).toBeNull();
    expect(dialog()).not.toBeNull();

    await advanceClock(1);
    const status = loader();
    expect(status).not.toBeNull();
    expect(status?.closest('[aria-busy="true"]')).not.toBeNull();
    expect(dialog()).toBeNull();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(loader()).not.toBeNull();

    await respond(noContentResponse());
    await advanceClock(500);
  });

  it.each([
    ['a copied title', 'Coco'],
    ['a linked title', 'Heat'],
  ])('says nothing about files for %s', async (_, title) => {
    await openDeleteOn(title);
    pressDelete(title);
    await advanceClock(300);

    const card = screen.getByRole('dialog');
    expect(loader(title)).not.toBeNull();
    expect(
      within(card).queryByText(/file|folder|recycle|original|keep/i)
    ).toBeNull();

    await respond(noContentResponse());
    await advanceClock(500);
  });
});

describe('ManageLibrary — a delete that lands', () => {
  it('closes, the row gone, with its notice, only once the hold is out', async () => {
    await openDeleteOn();
    pressDelete();
    await advanceClock(300);

    await respond(noContentResponse());
    await advanceClock(499);
    expect(loader()).not.toBeNull();
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(screen.getAllByText('Coco').length).toBeGreaterThan(0);

    await advanceClock(1);
    expect(loader()).toBeNull();
    expect(dialog()).toBeNull();
    expect(screen.getByText(NOTICE)).toBeDefined();
    expect(screen.queryByText('Coco')).toBeNull();
  });
});

describe('ManageLibrary — a failed delete', () => {
  it('returns, after the hold, to the live idle face with the failure line, the row kept', async () => {
    await openDeleteOn();
    pressDelete();
    await advanceClock(300);

    await respond(serverErrorResponse());
    await advanceClock(499);
    expect(loader()).not.toBeNull();
    expect(screen.queryByText(FAILED)).toBeNull();

    await advanceClock(1);
    expect(loader()).toBeNull();
    expect(within(liveDialog()).getByText(FAILED)).toBeDefined();
    expect(confirm().disabled).toBe(false);
    expect(confirm().getAttribute('aria-busy')).not.toBe('true');
    expect(confirm().textContent).toBe('Delete movie');
    expect(cancel().disabled).toBe(false);
    expect(screen.queryByText(NOTICE)).toBeNull();

    // Live again: the ✕ is back, and Cancel closes it over the kept row.
    expect(
      within(liveDialog()).getByRole('button', { name: 'Close' })
    ).toBeDefined();
    fireEvent.click(cancel());
    expect(dialog()).toBeNull();
    expect(screen.getByText('Coco')).toBeDefined();
  });

  it('draws the failure line above the buttons', async () => {
    await openDeleteOn();
    await failOnce();

    const line = within(liveDialog()).getByText(FAILED);
    expect(
      line.compareDocumentPosition(confirm()) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('clears the failure line on the next confirm, before the new attempt is answered', async () => {
    await openDeleteOn();
    await failOnce();
    expect(within(liveDialog()).getByText(FAILED)).toBeDefined();

    fireEvent.click(confirm());

    expect(screen.queryByText(FAILED)).toBeNull();
    expect(confirm().getAttribute('aria-busy')).toBe('true');

    await respond(noContentResponse());
    await advanceClock(500);
  });
});
