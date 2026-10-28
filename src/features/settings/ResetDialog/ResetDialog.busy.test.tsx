import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { ResetDialog } from './ResetDialog';
import { theme } from '@/styles/theme';
import { stubLocation } from '@/test-support/stubLocation/stubLocation';
import {
  conflictResponse,
  noContentResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';

/**
 * 53, Loading states, Phase 5 (issue #487): the Reset dialog on the
 * **Loader timing**.
 *
 * From the confirm press the dialog is **Locked**: no ✕, Escape and the scrim
 * ask nothing, and _Cancel_ is disabled, in `waiting` too. Once the reset has
 * run 300ms the dialog becomes the **Dialog loader** reading _Erasing
 * everything_. A reset that lands reloads onto `/` as it always has, only after
 * the 500ms hold; a refused one returns to the live idle face with its own
 * refusal sentence.
 *
 * The clock is faked from the press on.
 */

const { respond } = heldFetch();

afterEach(() => {
  vi.useRealTimers();
});

const TITLE = 'Erase everything?';
const ERASING = 'Erasing everything';
const IMPORT_RUNNING =
  'An import is running. Stop it before erasing everything.';

function renderDialog(onClose: () => void = () => undefined) {
  return render(
    <ThemeProvider theme={theme}>
      <ResetDialog open onClose={onClose} />
    </ThemeProvider>
  );
}

const dialog = () => screen.queryByRole('dialog', { name: TITLE });
const liveDialog = () => dialog() as HTMLElement;
const erase = () =>
  within(liveDialog()).getByRole('button', {
    name: /^Eras/,
  }) as HTMLButtonElement;
const cancel = () =>
  within(liveDialog()).getByRole('button', {
    name: 'Cancel',
  }) as HTMLButtonElement;
const loader = () => screen.queryByRole('status', { name: ERASING });

/** Press _Erase everything_ on a faked clock. */
function pressErase() {
  vi.useFakeTimers();
  fireEvent.click(erase());
}

describe('ResetDialog: locked from the confirm press', () => {
  stubLocation();

  it('locks at once, while waiting: no ✕, Cancel disabled, the confirm busy on its idle label', async () => {
    const onClose = vi.fn();
    renderDialog(onClose);
    pressErase();

    expect(erase().disabled).toBe(true);
    expect(erase().getAttribute('aria-busy')).toBe('true');
    expect(erase().textContent).toBe('Erase everything');
    expect(cancel().disabled).toBe(true);
    expect(
      within(liveDialog()).queryByRole('button', { name: 'Close' })
    ).toBeNull();

    fireEvent.click(cancel());
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    fireEvent.click(liveDialog().parentElement as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();

    await respond(noContentResponse());
    await advanceClock(500);
  });

  it('becomes the dialog loader reading Erasing everything at 300ms, still locked', async () => {
    const onClose = vi.fn();
    renderDialog(onClose);
    pressErase();

    await advanceClock(299);
    expect(loader()).toBeNull();
    expect(dialog()).not.toBeNull();

    await advanceClock(1);
    const status = loader();
    expect(status).not.toBeNull();
    expect(status?.closest('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole('dialog').contains(status)).toBe(true);
    // The idle face is gone: one card on screen, the loader's.
    expect(dialog()).toBeNull();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
    expect(loader()).not.toBeNull();

    await respond(noContentResponse());
    await advanceClock(500);
  });
});

describe('ResetDialog: a reset that lands', () => {
  const location = stubLocation();

  it('reloads onto / only once the loader’s hold is out', async () => {
    renderDialog();
    pressErase();
    await advanceClock(300);

    await respond(noContentResponse());
    expect(location.assigned()).toEqual([]);

    await advanceClock(499);
    expect(location.assigned()).toEqual([]);
    expect(loader()).not.toBeNull();

    await advanceClock(1);
    expect(location.assigned()).toEqual(['/']);
  });
});

describe('ResetDialog: a refused reset', () => {
  const location = stubLocation();

  it('returns, after the hold, to the live idle face with its refusal sentence', async () => {
    const onClose = vi.fn();
    renderDialog(onClose);
    pressErase();
    await advanceClock(300);

    await respond(conflictResponse(IMPORT_RUNNING));
    await advanceClock(499);
    expect(loader()).not.toBeNull();
    expect(screen.queryByText(IMPORT_RUNNING)).toBeNull();

    await advanceClock(1);
    expect(loader()).toBeNull();
    expect(dialog()).not.toBeNull();
    expect(within(liveDialog()).getByText(IMPORT_RUNNING)).toBeDefined();
    expect(erase().disabled).toBe(false);
    expect(erase().getAttribute('aria-busy')).not.toBe('true');
    expect(erase().textContent).toBe('Erase everything');
    expect(cancel().disabled).toBe(false);
    expect(location.assigned()).toEqual([]);

    // Live again: every way out asks to close.
    fireEvent.click(
      within(liveDialog()).getByRole('button', { name: 'Close' })
    );
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    fireEvent.click(cancel());
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
