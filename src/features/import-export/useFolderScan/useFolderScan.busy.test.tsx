import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { useFolderScan } from './useFolderScan';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import {
  conflictResponse,
  createdResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';

/**
 * 69, Silent waits, Phase 4 (issue #658): `useFolderScan`'s `scanning` is a
 * **Busy phase** on the **Loader timing**, beside `scope`, the **Scan scope**
 * pressed.
 *
 * `waiting` from the press, `shown` once the scan has run 300ms, and held
 * 500ms once shown; the push to `/import`, on a `201` and on a `409` alike,
 * comes only once the hold is out.
 */

const { respond } = heldFetch();

afterEach(() => {
  vi.useRealTimers();
});

function Screen() {
  const { scanning, scope, scan } = useFolderScan();

  return (
    <>
      <span data-testid="scanning">{scanning}</span>
      <span data-testid="scope">{String(scope)}</span>
      <button type="button" onClick={() => void scan(false, 'link', 'new')}>
        Scan new folders
      </button>
      <button type="button" onClick={() => void scan(false, 'link', 'all')}>
        Scan all folders
      </button>
    </>
  );
}

function renderAtFolders() {
  render(
    <MemoryRouter initialEntries={['/settings/folders']}>
      <LocationProbe />
      <Routes>
        <Route path="/settings/folders" element={<Screen />} />
        <Route path="/import" element={<span>Import screen</span>} />
      </Routes>
    </MemoryRouter>
  );
}

const scanning = () => screen.getByTestId('scanning').textContent;

/** Press a scan on a faked clock. */
function press(name: string) {
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name }));
}

describe('useFolderScan: scanning on the Loader timing', () => {
  it('is idle before a press', () => {
    renderAtFolders();

    expect(scanning()).toBe('idle');
  });

  it.each([
    ['Scan new folders', 'new'],
    ['Scan all folders', 'all'],
  ])(
    '%s moves through waiting and shown, naming scope %s',
    async (name, scope) => {
      renderAtFolders();
      press(name);

      expect(scanning()).toBe('waiting');
      expect(screen.getByTestId('scope').textContent).toBe(scope);

      await advanceClock(299);
      expect(scanning()).toBe('waiting');

      await advanceClock(1);
      expect(scanning()).toBe('shown');
    }
  );

  it.each([
    ['201', () => createdResponse(makeImportRun({ source: 'folders' }))],
    ['409', () => conflictResponse('An import is already running.')],
  ])(
    'pushes /import on a %s only once the hold is out',
    async (_status, answer) => {
      renderAtFolders();
      press('Scan all folders');

      await advanceClock(400);
      await respond(answer());

      await advanceClock(399);
      expect(pathname()).toBe('/settings/folders');
      expect(scanning()).toBe('shown');

      await advanceClock(1);
      expect(pathname()).toBe('/import');
    }
  );
});
