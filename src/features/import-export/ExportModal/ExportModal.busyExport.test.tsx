import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { ExportModal } from './ExportModal';
import { theme } from '@/styles/theme';
import type { ExportResult, ExportSummary } from '@/types';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';

/**
 * 53 — Loading states, Phase 3 (issue #485): the Export dialog's busy button.
 *
 * `exporting` runs on the **Loader timing**: _Export as CSV_ locks at once on
 * its idle label, reads _Exporting…_ only once the export has run 300ms, and
 * the export's outcome (**Export ready**, or a refusal under its field) is
 * drawn only after the 500ms hold, because it follows `run`'s promise. The
 * dialog is not locked: the ✕, Escape and the scrim still dismiss it while it
 * works.
 *
 * The summary lands on real timers; the clock is faked from the press on.
 */

const NAME = 'familyflix-collection_08-10-2026';

const SUMMARY: ExportSummary = {
  movieCount: 3,
  seriesCount: 1,
  episodeCount: 8,
  defaultDestination: 'E:\\Movies',
  defaultName: NAME,
};

const WRITTEN: ExportResult = {
  folder: `E:\\Movies\\${NAME}`,
  movieCount: 3,
  seriesCount: 1,
};

const REFUSAL = 'No folder at that path.';

/** A 400 carrying the route's one sentence, about _Save to_. */
function badRequest(error: string): Response {
  return {
    ok: false,
    status: 400,
    json: () => Promise.resolve({ error, field: 'destination' }),
  } as unknown as Response;
}

const { respond } = heldFetch((_url, init) =>
  init?.method === 'POST' ? undefined : okResponse(SUMMARY)
);

afterEach(() => {
  vi.useRealTimers();
});

/** The dialog open, its summary landed. */
async function renderDialog(onClose: () => void = () => undefined) {
  render(
    <ThemeProvider theme={theme}>
      <ExportModal open onClose={onClose} />
    </ThemeProvider>
  );
  await act(async () => undefined);
  await act(async () => undefined);
}

const dialog = () => screen.getByRole('dialog');
const idleDialog = () =>
  screen.queryByRole('dialog', { name: 'Export library' });
const readyDialog = () =>
  screen.queryByRole('dialog', { name: 'Export ready' });

/** The export button, under whichever label it wears. */
const exportButton = () =>
  within(dialog()).getByRole('button', {
    name: /^(Export as CSV|Exporting…)$/,
  }) as HTMLButtonElement;

/** Press _Export as CSV_ on a faked clock. */
function pressExport() {
  vi.useFakeTimers();
  fireEvent.click(exportButton());
}

describe('ExportModal — Export on the Loader timing', () => {
  it('locks at once on Export as CSV, and reads Exporting… only after 300ms', async () => {
    await renderDialog();
    pressExport();

    expect(exportButton().disabled).toBe(true);
    expect(exportButton().getAttribute('aria-busy')).toBe('true');
    expect(exportButton().textContent).toBe('Export as CSV');

    await advanceClock(299);
    expect(exportButton().textContent).toBe('Export as CSV');
    expect(screen.queryByText('Exporting…')).toBeNull();

    await advanceClock(1);
    expect(exportButton().textContent).toBe('Exporting…');
    expect(
      exportButton().querySelector('[aria-live="polite"]')?.textContent
    ).toBe('Exporting…');

    await respond(createdResponse(WRITTEN));
    await advanceClock(500);
  });

  it('never reads Exporting… for an export under 300ms, and is ready at once', async () => {
    await renderDialog();
    pressExport();

    await advanceClock(100);
    expect(exportButton().textContent).toBe('Export as CSV');
    await respond(createdResponse(WRITTEN));
    await advanceClock(0);

    expect(readyDialog()).not.toBeNull();
    expect(screen.queryByText('Exporting…')).toBeNull();
  });

  it('draws Export ready only once the 500ms hold is out', async () => {
    await renderDialog();
    pressExport();

    // Shown at 300ms; the export lands at 400ms; the hold runs to 800ms.
    await advanceClock(400);
    await respond(createdResponse(WRITTEN));

    await advanceClock(399);
    expect(idleDialog()).not.toBeNull();
    expect(readyDialog()).toBeNull();
    expect(exportButton().textContent).toBe('Exporting…');

    await advanceClock(1);
    expect(readyDialog()).not.toBeNull();
  });

  it('draws a refusal only once the 500ms hold is out', async () => {
    await renderDialog();
    pressExport();

    await advanceClock(400);
    await respond(badRequest(REFUSAL));

    await advanceClock(399);
    expect(screen.queryByText(REFUSAL)).toBeNull();
    expect(exportButton().textContent).toBe('Exporting…');

    await advanceClock(1);
    expect(screen.getByText(REFUSAL)).toBeDefined();
    expect(exportButton().textContent).toBe('Export as CSV');
  });

  it.each<[string, () => void]>([
    [
      'the ✕',
      () =>
        fireEvent.click(
          within(dialog()).getByRole('button', { name: 'Close' })
        ),
    ],
    ['Escape', () => fireEvent.keyDown(dialog(), { key: 'Escape' })],
    ['the scrim', () => fireEvent.click(dialog().parentElement as Element)],
  ])('is still dismissed by %s while busy', async (_, dismiss) => {
    const onClose = vi.fn();
    await renderDialog(onClose);
    pressExport();
    await advanceClock(300);
    expect(exportButton().getAttribute('aria-busy')).toBe('true');
    expect(exportButton().textContent).toBe('Exporting…');

    dismiss();

    expect(onClose).toHaveBeenCalledTimes(1);
    await respond(createdResponse(WRITTEN));
    await advanceClock(500);
  });
});
