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
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import {
  makeLibraryMovie,
  makeLibrarySeries,
} from '@/test-support/makeLibraryTitle/makeLibraryTitle';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';

/**
 * 53, Loading states, Phase 3 (issue #485): the Clear dialog's busy button.
 *
 * `clearing` runs on the **Loader timing**: _Clear details_ locks at once on
 * its idle label, reads _Clearing…_ only once the clear has run 300ms, and
 * the dialog closes (with its notice) only after the 500ms hold, because the
 * close follows `run`'s promise. The dialog is not locked: the ✕, Escape and
 * the scrim still dismiss it while it works.
 *
 * The list is read on real timers; the clock is faked from the press on.
 */

const LIBRARY: LibraryTitles = {
  movies: [makeLibraryMovie({ id: 'm1', title: 'Coco', details: 'synced' })],
  series: [makeLibrarySeries({ id: 's1', title: 'Bluey', details: 'synced' })],
};

const CLEARED_COCO = makeLibraryMovie({
  id: 'm1',
  title: 'Coco',
  year: null,
  details: 'none',
});

const NOTICE = 'Details cleared for “Coco”.';

const { respond } = heldFetch((url) =>
  url === '/api/library-titles' ? okResponse(LIBRARY) : undefined
);

afterEach(() => {
  vi.useRealTimers();
});

/** The page with the list landed and the Clear dialog open over Coco. */
async function openClearOnCoco() {
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
  const more = screen.getByRole('button', { name: 'More actions for “Coco”' });
  more.focus();
  fireEvent.click(more);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Clear details' }));
}

const clearDialog = () =>
  screen.queryByRole('dialog', { name: 'Clear details?' });

/** The confirm, under whichever label it wears. */
const confirm = () =>
  within(clearDialog() as HTMLElement).getByRole('button', {
    name: /^(Clear details|Clearing…)$/,
  }) as HTMLButtonElement;

/** Press _Clear details_ on a faked clock. */
function pressClear() {
  vi.useFakeTimers();
  fireEvent.click(confirm());
}

/** Answer the clear with the echo, and let the hold run out. */
async function finish() {
  await respond(okResponse(CLEARED_COCO));
  await advanceClock(500);
}

describe('ManageLibrary: Clear on the Loader timing', () => {
  it('locks at once on Clear details, and reads Clearing… only after 300ms', async () => {
    await openClearOnCoco();
    pressClear();

    expect(confirm().disabled).toBe(true);
    expect(confirm().getAttribute('aria-busy')).toBe('true');
    expect(confirm().textContent).toBe('Clear details');

    await advanceClock(299);
    expect(confirm().textContent).toBe('Clear details');
    expect(screen.queryByText('Clearing…')).toBeNull();

    await advanceClock(1);
    expect(confirm().textContent).toBe('Clearing…');
    expect(confirm().querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Clearing…'
    );

    await finish();
  });

  it('never reads Clearing… for a clear under 300ms, and closes at once', async () => {
    await openClearOnCoco();
    pressClear();

    await advanceClock(100);
    expect(confirm().textContent).toBe('Clear details');
    await respond(okResponse(CLEARED_COCO));
    await advanceClock(0);

    expect(clearDialog()).toBeNull();
    expect(screen.queryByText('Clearing…')).toBeNull();
    expect(screen.getByText(NOTICE)).toBeDefined();
  });

  it('closes, with its notice, only once the 500ms hold is out', async () => {
    await openClearOnCoco();
    pressClear();

    // Shown at 300ms; the clear lands at 400ms; the hold runs to 800ms.
    await advanceClock(400);
    await respond(okResponse(CLEARED_COCO));

    await advanceClock(399);
    expect(clearDialog()).not.toBeNull();
    expect(confirm().textContent).toBe('Clearing…');
    expect(screen.queryByText(NOTICE)).toBeNull();

    await advanceClock(1);
    expect(clearDialog()).toBeNull();
    expect(screen.getByText(NOTICE)).toBeDefined();
  });

  it.each<[string, () => void]>([
    [
      'the ✕',
      () =>
        fireEvent.click(
          within(clearDialog() as HTMLElement).getByRole('button', {
            name: 'Close',
          })
        ),
    ],
    [
      'Escape',
      () => fireEvent.keyDown(clearDialog() as HTMLElement, { key: 'Escape' }),
    ],
    [
      'the scrim',
      () =>
        fireEvent.click(
          (clearDialog() as HTMLElement).parentElement as Element
        ),
    ],
  ])('is still dismissed by %s while busy', async (_, dismiss) => {
    await openClearOnCoco();
    pressClear();
    await advanceClock(300);
    expect(confirm().getAttribute('aria-busy')).toBe('true');
    expect(confirm().textContent).toBe('Clearing…');

    dismiss();

    expect(clearDialog()).toBeNull();
    await finish();
  });
});
