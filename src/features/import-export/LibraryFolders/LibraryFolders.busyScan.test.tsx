import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { LibraryFolders } from './LibraryFolders';
import type { LibraryFolderView } from '@/types';
import { theme } from '@/styles/theme';
import {
  conflictResponse,
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';
import { makeLibraryFolder } from '@/test-support/makeLibraryFolder/makeLibraryFolder';

/**
 * 69, Silent waits, Phase 4 (issue #658): the two scan presses as busy
 * buttons.
 *
 * The pressed one locks at once on its idle label and reads _Scanning…_ only
 * once the scan has run 300ms; the other is disabled, and never reads
 * _Scanning…_. The move to the progress screen, on a `201` or to the running
 * run on a `409`, comes only once the 500ms hold is out.
 *
 * The list is read on real timers; the clock is faked from the press on.
 */

const NEW_FOLDER: LibraryFolderView = {
  ...makeLibraryFolder({ id: 'f-kids', path: 'D:\\Kids', scannedAt: null }),
  leftOut: 0,
};

const { respond } = heldFetch((url, init) => {
  if ((init?.method ?? 'GET') !== 'GET') {
    return undefined;
  }
  return url.includes('/api/tmdb/key')
    ? okResponse({ key: null })
    : okResponse([NEW_FOLDER]);
});

afterEach(() => {
  vi.useRealTimers();
});

async function landed() {
  render(
    <MemoryRouter initialEntries={['/settings/folders']}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/settings/folders" element={<LibraryFolders />} />
          <Route path="/import" element={<p>the import screen</p>} />
        </Routes>
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
  await waitFor(() =>
    expect(screen.queryByText(NEW_FOLDER.path)).not.toBeNull()
  );
}

const scanNew = () =>
  screen.getByRole('button', {
    name: /^(Scan new folders|Scanning…)$/,
  }) as HTMLButtonElement;

const scanAll = () =>
  screen.getByRole('button', {
    name: /^(Scan all folders|Scanning…)$/,
  }) as HTMLButtonElement;

const BUTTONS = [
  { pressed: 'Scan all folders', button: scanAll, other: scanNew },
  { pressed: 'Scan new folders', button: scanNew, other: scanAll },
];

describe.each(BUTTONS)(
  'LibraryFolders: $pressed on the Loader timing',
  ({ pressed, button, other }) => {
    it('reads Scanning… only on the pressed button, past 300ms; the other is disabled', async () => {
      await landed();
      const theButton = screen.getByRole('button', { name: pressed });
      const theOther = other();
      vi.useFakeTimers();
      fireEvent.click(theButton);

      expect(theButton.getAttribute('aria-busy')).toBe('true');
      expect(theButton.textContent).toBe(pressed);
      expect((theOther as HTMLButtonElement).disabled).toBe(true);
      expect(theOther.hasAttribute('aria-busy')).toBe(false);

      await advanceClock(299);
      expect(screen.queryByText('Scanning…')).toBeNull();

      await advanceClock(1);
      expect(theButton.textContent).toBe('Scanning…');
      expect(button()).toBe(theButton);
      expect(theOther.textContent).not.toContain('Scanning…');
      expect((theOther as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getAllByText('Scanning…')).toHaveLength(1);
    });
  }
);

describe('LibraryFolders: the scan leaves only once the hold is out', () => {
  it.each([
    ['201', () => createdResponse(makeImportRun({ source: 'folders' }))],
    ['409', () => conflictResponse('An import is already running.')],
  ])('on a %s', async (_status, answer) => {
    await landed();
    vi.useFakeTimers();
    fireEvent.click(scanAll());

    await advanceClock(400);
    await respond(answer());

    await advanceClock(399);
    expect(pathname()).toBe('/settings/folders');
    expect(scanAll().textContent).toBe('Scanning…');

    await advanceClock(1);
    expect(pathname()).toBe('/import');
  });
});
