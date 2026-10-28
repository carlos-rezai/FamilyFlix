import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { LibraryFolders } from './LibraryFolders';
import type { LibraryFolder } from '@/types';
import { theme } from '@/styles/theme';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';

/**
 * 53 — Loading states, Phase 4 (issue #486): Library folders' _Add_ as a busy
 * button.
 *
 * `useLibraryFolders`' `adding` runs on the **Loader timing**: _Add_ locks at
 * once on its idle label, reads _Adding…_ only once the add has run 300ms (it
 * had no label change before), and the new row or the refusal line appears
 * only after the 500ms hold. _Browse…_ beside it is disabled from the press
 * until the add settles.
 *
 * Drawn under the Desktop shell, so _Browse…_ is there. The list is read on
 * real timers; the clock is faked from the press on.
 */

const KIDS: LibraryFolder = {
  id: 'f-kids',
  path: 'D:\\Kids',
  titleCount: 0,
  reachable: true,
};

const INSIDE =
  'That folder is inside E:\\Movies, which is already a library folder.';

/** A refusal the route words: `{ error }` under its status. */
function refusedResponse(status: number, error: string): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
  } as unknown as Response;
}

const { respond } = heldFetch((_url, init) =>
  (init?.method ?? 'GET') === 'POST' ? undefined : okResponse([])
);

afterEach(() => {
  vi.useRealTimers();
});

/** _Add_, under whichever label it wears. */
const addButton = () =>
  screen.getByRole('button', { name: /^(Add|Adding…)$/ }) as HTMLButtonElement;

const browseButton = () =>
  screen.getByRole('button', { name: 'Browse…' }) as HTMLButtonElement;

/** The page with the list landed and `D:\Kids` typed in the add row. */
async function typedKids() {
  render(
    <MemoryRouter initialEntries={['/settings/folders']}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/settings/folders" element={<LibraryFolders />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeNull());
  fireEvent.change(screen.getByRole('textbox', { name: 'Folder path' }), {
    target: { value: KIDS.path },
  });
}

/** Press _Add_ on a faked clock. */
function pressAdd() {
  vi.useFakeTimers();
  fireEvent.click(addButton());
}

async function answer(response: Response) {
  await respond(response);
}

describe('LibraryFolders — Add on the Loader timing', () => {
  fakeFolderBridge();

  it('locks at once on Add, and reads Adding… only after 300ms', async () => {
    await typedKids();
    pressAdd();

    expect(addButton().disabled).toBe(true);
    expect(addButton().getAttribute('aria-busy')).toBe('true');
    expect(addButton().textContent).toBe('Add');

    await advanceClock(299);
    expect(addButton().textContent).toBe('Add');
    expect(screen.queryByText('Adding…')).toBeNull();

    await advanceClock(1);
    expect(addButton().textContent).toBe('Adding…');
    expect(addButton().querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Adding…'
    );

    await answer(createdResponse(KIDS));
    await advanceClock(500);
  });

  it('never reads Adding… for an add under 300ms, and draws the row at once', async () => {
    await typedKids();
    pressAdd();

    await advanceClock(100);
    await answer(createdResponse(KIDS));
    await advanceClock(0);

    expect(screen.queryByText('Adding…')).toBeNull();
    expect(screen.getByText(KIDS.path)).toBeDefined();
  });

  it('draws the new row only once the 500ms hold is out', async () => {
    await typedKids();
    pressAdd();

    // Shown at 300ms; the add lands at 400ms; the hold runs to 800ms.
    await advanceClock(400);
    await answer(createdResponse(KIDS));

    await advanceClock(399);
    expect(addButton().textContent).toBe('Adding…');
    expect(screen.queryByText(KIDS.path)).toBeNull();
    expect(screen.getByText('No folders yet.')).toBeDefined();

    await advanceClock(1);
    expect(screen.getByText(KIDS.path)).toBeDefined();
    expect(screen.queryByText('No folders yet.')).toBeNull();
  });

  it('draws the refusal line only once the 500ms hold is out', async () => {
    await typedKids();
    pressAdd();

    await advanceClock(400);
    await answer(refusedResponse(409, INSIDE));

    await advanceClock(399);
    expect(addButton().textContent).toBe('Adding…');
    expect(screen.queryByText(INSIDE)).toBeNull();

    await advanceClock(1);
    expect(screen.getByText(INSIDE)).toBeDefined();
    expect(addButton().textContent).toBe('Add');
  });

  it('disables Browse… from the press, and makes it live again once the add settles', async () => {
    await typedKids();
    expect(browseButton().disabled).toBe(false);
    pressAdd();

    expect(browseButton().disabled).toBe(true);

    await advanceClock(400);
    await answer(createdResponse(KIDS));

    await advanceClock(399);
    expect(browseButton().disabled).toBe(true);

    await advanceClock(1);
    expect(browseButton().disabled).toBe(false);
  });
});
