import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ImportFlow } from './ImportFlow';
import type { ImportProblem, ImportRun } from '@/types';
import { theme } from '@/styles/theme';
import {
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';

/**
 * 69, Silent waits, Phase 5 (issue #657): the Import review's bulk buttons.
 *
 * With its route held open, _Import all as guessed_ and _Skip all_ beside a
 * chosen kind are each a Busy button: locked at once, so a second press sends
 * nothing, and reading _Importing…_ or _Skipping…_ past 300ms. Every row the
 * press covers is locked (`inert`, `aria-busy`) and draws no loader of its
 * own; the one loader is the button's. The covered rows leave only once the
 * hold is out.
 *
 * The review is read on real timers; the clock is faked from the press on.
 */

const noRow = (id: string, title: string): ImportProblem => ({
  id,
  kind: 'no-row',
  title,
  reason: `Reason ${id}.`,
  guess: title,
});

const PROBLEMS: ImportProblem[] = [
  {
    id: 'f1',
    kind: 'no-folder',
    title: 'The Lantern Keeper',
    reason: 'Reason f1.',
  },
  noRow('l1', 'Ironwood (2018)'),
  noRow('f2', 'The Night Ferry'),
];

const COVERED = ['Reason l1.', 'Reason f2.'];

const reviewOf = (problems: ImportProblem[], matched = 2): ImportRun =>
  makeImportRun({
    phase: 'review',
    found: 9,
    total: matched,
    done: matched,
    matched,
    problems,
  });

/** What both bulk routes echo: the covered rows settled. */
const ECHO = reviewOf([PROBLEMS[0]], 4);

const pathOf = (url: string) => new URL(url, 'http://localhost').pathname;
const verbOf = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();

const BULK_IMPORT = '/api/import/current/problems/import-guessed';
const BULK_DISMISS = '/api/import/current/problems/dismiss';

/** Every read answered at once; only a bulk press is held open. */
const { fetchMock, respond } = heldFetch((url, init) => {
  const p = pathOf(url);
  if (verbOf(init) === 'POST' && (p === BULK_IMPORT || p === BULK_DISMISS)) {
    return undefined;
  }
  if (p === '/api/import/current') return okResponse(reviewOf(PROBLEMS));
  if (p === '/api/library-folders') return okResponse([]);
  if (p === '/api/tmdb/key') return okResponse({ key: null });
  return notFoundResponse('Not found');
});

afterEach(() => {
  vi.useRealTimers();
});

const sentTo = (route: string) =>
  fetchMock.mock.calls.filter(
    ([input, init]) =>
      pathOf(String(input)) === route && verbOf(init) === 'POST'
  );

const filter = () =>
  screen.getByRole('group', { name: 'Problem kinds' }) as HTMLElement;
const besideFilter = () => filter().parentElement?.parentElement as HTMLElement;

/** The Problem row that draws `reason`: the Busy row's root once locked. */
const busyRowOf = (reason: string) =>
  screen.queryByText(reason)?.closest<HTMLElement>('[aria-busy="true"]') ??
  null;

/** The review drawn, _Not in sheet_ chosen, the clock faked, `name` pressed. */
async function pressedBeside(name: string) {
  render(
    <MemoryRouter initialEntries={['/settings', '/import']} initialIndex={1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/settings" element={<p>the settings hub</p>} />
          <Route path="/import" element={<ImportFlow />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
  await screen.findByText('Reason l1.');
  fireEvent.click(
    within(filter()).getByRole('button', { name: 'Not in sheet 2' })
  );
  vi.useFakeTimers();
  fireEvent.click(within(besideFilter()).getByRole('button', { name }));
}

interface BulkPress {
  name: string;
  route: string;
  label: string;
}

const BULK: BulkPress[] = [
  { name: 'Import all as guessed', route: BULK_IMPORT, label: 'Importing…' },
  { name: 'Skip all', route: BULK_DISMISS, label: 'Skipping…' },
];

describe.each(BULK)(
  'ImportFlow: $name as a Busy button',
  ({ name, route, label }) => {
    it('locks at once, so a second press sends nothing', async () => {
      await pressedBeside(name);

      expect(sentTo(route)).toHaveLength(1);
      const button = within(besideFilter()).getByRole('button', {
        name,
      }) as HTMLButtonElement;
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.disabled).toBe(true);

      fireEvent.click(button);
      await advanceClock(0);
      expect(sentTo(route)).toHaveLength(1);

      await respond(okResponse(ECHO));
      await advanceClock(500);
    });

    it(`reads ${label} past 300ms`, async () => {
      await pressedBeside(name);

      await advanceClock(299);
      expect(
        within(besideFilter()).queryByRole('button', { name: label })
      ).toBeNull();
      await advanceClock(1);
      expect(
        within(besideFilter()).getByRole('button', { name: label })
      ).toBeDefined();

      await respond(okResponse(ECHO));
      await advanceClock(500);
    });

    it('locks every row it covers at once', async () => {
      await pressedBeside(name);

      for (const reason of COVERED) {
        const row = busyRowOf(reason);
        expect(row).not.toBeNull();
        expect(row?.hasAttribute('inert')).toBe(true);
      }

      await respond(okResponse(ECHO));
      await advanceClock(500);
    });

    it(`draws no loader in any covered row, even once ${label} is shown`, async () => {
      await pressedBeside(name);
      await advanceClock(300);

      for (const reason of COVERED) {
        const row = busyRowOf(reason);
        expect(row).not.toBeNull();
        expect(row?.hasAttribute('inert')).toBe(true);
        expect(
          within(row as HTMLElement).queryAllByRole('status', { hidden: true })
        ).toEqual([]);
      }

      await respond(okResponse(ECHO));
      await advanceClock(500);
    });

    it('sends once, and the covered rows leave only once the hold is out', async () => {
      await pressedBeside(name);
      fireEvent.click(within(besideFilter()).getByRole('button', { name }));

      // Shown at 300; the echo lands at 400; the hold runs to 800.
      await advanceClock(400);
      await respond(okResponse(ECHO));

      await advanceClock(399);
      for (const reason of COVERED) {
        expect(screen.getByText(reason)).toBeDefined();
      }

      await advanceClock(1);
      for (const reason of COVERED) {
        expect(screen.queryByText(reason)).toBeNull();
      }
      expect(sentTo(route)).toHaveLength(1);
    });
  }
);
