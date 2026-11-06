import { describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { TidyDialog } from './TidyDialog';
import type { TidyPlan, TidyResult } from '@/types';
import { theme } from '@/styles/theme';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import {
  conflictResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';

/**
 * 57 — Tidy into folders, Phase 7: "the Tidy dialog moves" (issue #530).
 *
 * The **Tidy dialog**'s footer draws **Move N videos** / _Move 1 video_
 * (`primary`, Busy) and _Cancel_, or only _Close_ when there is nothing to
 * move. The press posts the ids drawn to `POST /api/library-folders/:id/tidy`.
 * All moved: the dialog closes on the snackbar _Moved N videos into folders
 * of their own. Scan all folders to add them._ Some failed: it stays open,
 * listing each failure under the count moved. A `409` shows its sentence.
 *
 * The plan's read is answered at once; the move is held until the test
 * answers it.
 */

let plan: TidyPlan;

const wire = heldFetch((url) =>
  url.endsWith('/loose') ? okResponse(plan) : undefined
);

const PATH = 'E:\\Movies';

const APEX = {
  id: 'apex.2026.1080p.mp4',
  kind: 'film' as const,
  folder: 'Apex (2026)',
  videos: ['Apex.2026.1080p.mp4'],
  companions: ['Apex.2026.1080p.en.srt'],
};

const HARBOR = {
  id: 'harbor.lights.2019.mp4',
  kind: 'film' as const,
  folder: 'Harbor Lights (2019)',
  videos: ['Harbor.Lights.2019.mp4'],
  companions: [],
};

const KEPT = {
  files: ['Northwind (2019).mp4'],
  reason: 'A folder called “Northwind (2019)” is already here.',
  folder: 'Northwind (2019)',
};

function renderDialog(drawn: TidyPlan) {
  plan = drawn;
  const onClose = vi.fn();
  render(
    <ThemeProvider theme={theme}>
      <SnackbarProvider>
        <TidyDialog open folderId="f-movies" path={PATH} onClose={onClose} />
      </SnackbarProvider>
    </ThemeProvider>
  );
  return { onClose };
}

const TWO: TidyPlan = { path: PATH, tidies: [APEX, HARBOR], kept: [KEPT] };

/** The footer's _Close_: a button reading Close, not the Modal's ✕. */
const footerClose = () =>
  screen
    .queryAllByRole('button', { name: 'Close' })
    .filter((button) => button.textContent === 'Close');

const moveCalls = () =>
  wire.fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/tidy'));

describe('TidyDialog: the footer', () => {
  it('reads Move N videos beside Cancel, and draws no Close', async () => {
    renderDialog(TWO);

    expect(
      await screen.findByRole('button', { name: 'Move 2 videos' })
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
    expect(footerClose()).toHaveLength(0);
  });

  it('reads Move 1 video for one', async () => {
    renderDialog({ path: PATH, tidies: [APEX], kept: [] });

    expect(
      await screen.findByRole('button', { name: 'Move 1 video' })
    ).toBeDefined();
  });

  it('draws only Close when there is nothing to move, its Cancel only beside a Move', async () => {
    renderDialog({ path: PATH, tidies: [], kept: [KEPT] });

    expect(await screen.findByText('Left where they are')).toBeDefined();
    expect(footerClose()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Move/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    cleanup();
    renderDialog({ path: PATH, tidies: [HARBOR], kept: [KEPT] });

    expect(await screen.findByText('Left where they are')).toBeDefined();
    expect(footerClose()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
  });
});

describe('TidyDialog: the move', () => {
  it('posts the ids drawn to the folder’s tidy route', async () => {
    renderDialog(TWO);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Move 2 videos' })
    );

    const calls = moveCalls();
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0];
    expect(String(url)).toBe('/api/library-folders/f-movies/tidy');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      ids: ['apex.2026.1080p.mp4', 'harbor.lights.2019.mp4'],
    });
  });

  it('closes on the snackbar when all moved', async () => {
    const { onClose } = renderDialog(TWO);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Move 2 videos' })
    );

    const result: TidyResult = { moved: 2, failed: [] };
    await wire.respond(okResponse(result));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(
      screen.getByText(
        'Moved 2 videos into folders of their own. Scan all folders to add them.'
      )
    ).toBeDefined();
  });

  it('stays open on a partial failure, each failure listed under the count moved', async () => {
    const { onClose } = renderDialog(TWO);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Move 2 videos' })
    );

    const result: TidyResult = {
      moved: 1,
      failed: [
        {
          id: 'harbor.lights.2019.mp4',
          folder: 'Harbor Lights (2019)',
          reason: 'It’s open in another app.',
        },
      ],
    };
    await wire.respond(okResponse(result));

    const reason = await screen.findByText(/It’s open in another app\./);
    expect(screen.getByText(/moved into folders of their own/)).toBeDefined();
    const moved = screen.getByText(/moved into folders of their own/);
    expect(
      moved.compareDocumentPosition(reason) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(document.body.textContent).toMatch(/\b1\b\s*moved into folders/);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText(/^Moved \d+ videos? into folders/)).toBeNull();
  });

  it('shows the 409’s sentence', async () => {
    const { onClose } = renderDialog(TWO);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Move 2 videos' })
    );

    await wire.respond(conflictResponse('A scan is running.'));

    expect(await screen.findByText('A scan is running.')).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();
  });
});
