import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { LibraryFolders } from './LibraryFolders';
import type { LibraryFolderView } from '@/types';
import { theme } from '@/styles/theme';
import {
  conflictResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';
import { makeLibraryFolder } from '@/test-support/makeLibraryFolder/makeLibraryFolder';

/**
 * 69, Silent waits, Phase 4 (issue #658): a Folder row's ✕ and _Bring back_
 * as a **Busy row**, on the page.
 *
 * The press locks its own row at once (`inert`, `aria-busy`); past 300ms the
 * row reads _Removing…_ or _Bringing back…_ on its **Busy overlay**, its
 * _N titles_ line kept under it (71, issue #680);
 * the outcome lands only once the 500ms hold is out. A refused remove puts
 * the row back as it was, its sentence under it. Every other row stays
 * pressable meanwhile.
 *
 * The list is read on real timers; the clock is faked from the press on.
 */

const MOVIES: LibraryFolderView = {
  ...makeLibraryFolder({ id: 'f-movies', path: 'E:\\Movies', titleCount: 3 }),
  leftOut: 2,
};

const KIDS: LibraryFolderView = {
  ...makeLibraryFolder({ id: 'f-kids', path: 'D:\\Kids', titleCount: 1 }),
  leftOut: 0,
};

const IN_USE = 'An import is reading that folder right now.';

const { fetchMock, respond } = heldFetch((url, init) => {
  if ((init?.method ?? 'GET') !== 'GET') {
    return undefined;
  }
  return url.includes('/api/tmdb/key')
    ? okResponse({ key: null })
    : okResponse([MOVIES, KIDS]);
});

afterEach(() => {
  vi.useRealTimers();
});

const removeButton = (path: string) =>
  screen.getByRole('button', { name: `Remove ${path}` });

/** A Folder row's root, found from its ✕. */
const rowOf = (path: string) => removeButton(path).parentElement as HTMLElement;

async function landed() {
  render(
    <MemoryRouter initialEntries={['/settings/folders']}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/settings/folders" element={<LibraryFolders />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.queryByText(KIDS.path)).not.toBeNull());
  vi.useFakeTimers();
}

describe('LibraryFolders: a Folder row as a Busy row', () => {
  it('locks the ✕ row at once and reads Removing… past 300ms, its line kept', async () => {
    await landed();
    fireEvent.click(removeButton(KIDS.path));

    expect(rowOf(KIDS.path).hasAttribute('inert')).toBe(true);
    expect(rowOf(KIDS.path).getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('1 titles')).toBeDefined();

    await advanceClock(299);
    expect(screen.queryByText('Removing…')).toBeNull();

    await advanceClock(1);
    expect(screen.getByRole('status', { name: 'Removing…' })).toBeDefined();
    expect(screen.getByText('1 titles')).toBeDefined();

    await advanceClock(100);
    await respond(okResponse({}));
    await advanceClock(399);
    expect(screen.getByText(KIDS.path)).toBeDefined();

    await advanceClock(1);
    expect(screen.queryByText(KIDS.path)).toBeNull();
  });

  it('locks the Bring back row at once and reads Bringing back… past 300ms', async () => {
    await landed();
    fireEvent.click(screen.getByRole('button', { name: 'Bring back' }));

    expect(rowOf(MOVIES.path).getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByText('Bringing back…')).toBeNull();

    await advanceClock(300);
    expect(
      screen.getByRole('status', { name: 'Bringing back…' })
    ).toBeDefined();
    expect(screen.getByText('3 titles')).toBeDefined();

    await advanceClock(100);
    await respond(okResponse({}));
    await advanceClock(399);
    expect(screen.getByText('2 videos left out')).toBeDefined();

    await advanceClock(1);
    expect(screen.queryByText('2 videos left out')).toBeNull();
    expect(screen.getByText('3 titles')).toBeDefined();
  });

  it('puts a refused remove back as it was, its sentence under it', async () => {
    await landed();
    fireEvent.click(removeButton(KIDS.path));

    await advanceClock(400);
    await respond(conflictResponse(IN_USE));
    await advanceClock(399);
    expect(screen.queryByText(IN_USE)).toBeNull();
    expect(screen.getByText('Removing…')).toBeDefined();

    await advanceClock(1);
    expect(screen.getByText(IN_USE)).toBeDefined();
    expect(screen.queryByText('Removing…')).toBeNull();
    expect(screen.getByText('1 titles')).toBeDefined();
    expect(rowOf(KIDS.path).hasAttribute('inert')).toBe(false);
    expect(rowOf(KIDS.path).hasAttribute('aria-busy')).toBe(false);
  });

  it('leaves every other row pressable while one works', async () => {
    await landed();
    fireEvent.click(removeButton(KIDS.path));
    await advanceClock(300);

    const other = rowOf(MOVIES.path);
    expect(other.closest('[inert]')).toBeNull();
    expect(other.hasAttribute('aria-busy')).toBe(false);
    expect(screen.getByText('3 titles')).toBeDefined();

    fireEvent.click(removeButton(MOVIES.path));

    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')
    ).toHaveLength(2);
    expect(rowOf(MOVIES.path).getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status', { name: 'Removing…' })).toBeDefined();
  });
});
