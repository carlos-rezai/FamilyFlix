import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ImportFlow } from './ImportFlow';
import type { ImportProblem, ImportRun } from '@/types';
import { theme } from '@/styles/theme';
import {
  noContentResponse,
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';

/**
 * 69, Silent waits, Phase 3 (issue #656): the Import review's row presses.
 *
 * With its route held open, each of _Import as “…”_, a picked **Candidate
 * folder**, _Take out of library_, _Apply choices_, _Skip_ and _Keep all
 * mine_ locks its own **Problem row** at once, so a second press sends
 * nothing, every other row staying unlocked, and past 300ms reads its own
 * words. _Resolve_ stays a plain link: it opens the form as today, even
 * while another row is held.
 *
 * The review is read on real timers; the clock is faked from the press on.
 */

const IRONWOOD: ImportProblem = {
  id: 'p1',
  kind: 'no-row',
  title: 'Ironwood (2018)',
  reason: "Folder isn't in the spreadsheet.",
  guess: 'Ironwood (2018)',
};

const DIE_HARD: ImportProblem = {
  id: 'p2',
  kind: 'ambiguous',
  title: 'Die Hard',
  reason: 'Two folders look like plausible matches. Pick one.',
  candidates: [
    {
      path: 'D:/Films/Die.Hard.1988.1080p',
      name: 'Die.Hard.1988.1080p',
      videos: 1,
    },
    { path: 'D:/Films/Die Hard (1988)', name: 'Die Hard (1988)', videos: 2 },
  ],
};

const HEAT: ImportProblem = {
  id: 'p3',
  kind: 'differs',
  title: 'Heat',
  reason: 'The spreadsheet differs from the library.',
  movieId: 'm-heat',
  differences: [
    { field: 'director', label: 'Director', mine: 'Mann', sheet: 'M. Mann' },
  ],
};

const SUNDIAL: ImportProblem = {
  id: 'p4',
  kind: 'missing',
  title: 'Sundial',
  reason: 'Its video is gone from the folder.',
  movieId: 'm-sundial',
  takeOut: 'Take out of library',
};

const LANTERN: ImportProblem = {
  id: 'p5',
  kind: 'no-folder',
  title: 'The Lantern Keeper',
  reason: 'No folder found matching this spreadsheet row.',
};

const ALL = [IRONWOOD, DIE_HARD, HEAT, SUNDIAL, LANTERN];

const REVIEW: ImportRun = makeImportRun({
  phase: 'review',
  found: 9,
  total: 2,
  done: 2,
  matched: 2,
  problems: ALL,
});

const pathOf = (url: string) => new URL(url, 'http://localhost').pathname;
const verbOf = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();

/** The one request a test holds open; every other is answered at once. */
let holding: (path: string, verb: string) => boolean = () => false;

const { fetchMock, respond } = heldFetch((url, init) => {
  const p = pathOf(url);
  const verb = verbOf(init);
  if (holding(p, verb)) return undefined;
  if (p.startsWith('/api/import/current/problems/')) {
    return noContentResponse();
  }
  if (p === '/api/import/current') return okResponse(REVIEW);
  if (p === '/api/library-folders') return okResponse([]);
  if (p === '/api/tmdb/key') return okResponse({ key: null });
  return notFoundResponse('Not found');
});

afterEach(() => {
  vi.useRealTimers();
  holding = () => false;
});

const sentTo = (route: string, verb: string) =>
  fetchMock.mock.calls.filter(
    ([input, init]) => pathOf(String(input)) === route && verbOf(init) === verb
  );

/** The review drawn on real timers, then the clock faked. */
async function review() {
  render(
    <MemoryRouter initialEntries={['/settings', '/import']} initialIndex={1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/settings" element={<p>the settings hub</p>} />
          <Route path="/add" element={<p>the add form</p>} />
          <Route path="/import" element={<ImportFlow />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
  await screen.findByText(LANTERN.reason);
  vi.useFakeTimers();
}

/** The Busy row a reason sits in, or `null` while it is not one. */
const busyRowOf = (reason: string) =>
  screen.queryByText(reason)?.closest<HTMLElement>('[aria-busy="true"]') ??
  null;

/** The row a reason sits in: its card, above the head the reason sits in. */
const rowOf = (reason: string) =>
  screen.getByText(reason).parentElement?.parentElement
    ?.parentElement as HTMLElement;

const PROBLEMS = '/api/import/current/problems';

interface RowPress {
  press: string;
  problem: ImportProblem;
  route: string;
  verb: string;
  label: string;
  /** The control pressed, found in its own row. */
  button: () => HTMLElement;
}

const PRESSES: RowPress[] = [
  {
    press: 'Import as',
    problem: IRONWOOD,
    route: `${PROBLEMS}/p1/import`,
    verb: 'POST',
    label: 'Importing…',
    button: () =>
      screen.getByRole('button', { name: 'Import as “Ironwood (2018)”' }),
  },
  {
    press: 'a picked Candidate folder',
    problem: DIE_HARD,
    route: `${PROBLEMS}/p2/pick`,
    verb: 'POST',
    label: 'Importing…',
    button: () => screen.getByRole('button', { name: /^Die Hard \(1988\)/ }),
  },
  {
    press: 'Take out of library',
    problem: SUNDIAL,
    route: `${PROBLEMS}/p4/take-out`,
    verb: 'POST',
    label: 'Taking out…',
    button: () => screen.getByRole('button', { name: 'Take out of library' }),
  },
  {
    press: 'Apply choices',
    problem: HEAT,
    route: `${PROBLEMS}/p3/apply`,
    verb: 'POST',
    label: 'Updating details…',
    button: () => screen.getByRole('button', { name: 'Apply choices' }),
  },
  {
    press: 'Keep all mine',
    problem: HEAT,
    route: `${PROBLEMS}/p3`,
    verb: 'DELETE',
    label: 'Skipping…',
    button: () => screen.getByRole('button', { name: 'Keep all mine' }),
  },
  {
    press: 'Skip',
    problem: LANTERN,
    route: `${PROBLEMS}/p5`,
    verb: 'DELETE',
    label: 'Skipping…',
    button: () =>
      within(rowOf(LANTERN.reason)).getByRole('button', { name: 'Skip' }),
  },
];

describe.each(PRESSES)(
  'ImportFlow: $press as a Busy row',
  ({ problem, route, verb, label, button }) => {
    it('locks its own row at once: a second press sends no second request', async () => {
      holding = (p, v) => p === route && v === verb;
      await review();

      fireEvent.click(button());
      expect(sentTo(route, verb)).toHaveLength(1);
      const row = busyRowOf(problem.reason);
      expect(row).not.toBeNull();
      expect(row?.hasAttribute('inert')).toBe(true);

      fireEvent.click(button());
      await advanceClock(0);
      expect(sentTo(route, verb)).toHaveLength(1);

      await advanceClock(300);
      await respond(noContentResponse());
      await advanceClock(500);
    });

    it('leaves every other row unlocked', async () => {
      holding = (p, v) => p === route && v === verb;
      await review();

      fireEvent.click(button());
      await advanceClock(300);

      for (const other of ALL) {
        if (other.id === problem.id) continue;
        expect(busyRowOf(other.reason)).toBeNull();
      }
      expect(busyRowOf(problem.reason)).not.toBeNull();
    });

    it(`reads ${label} on its row past 300ms`, async () => {
      holding = (p, v) => p === route && v === verb;
      await review();

      fireEvent.click(button());
      await advanceClock(299);
      const row = busyRowOf(problem.reason);
      expect(row).not.toBeNull();
      expect(within(row as HTMLElement).queryByRole('status')).toBeNull();

      await advanceClock(1);
      expect(
        within(row as HTMLElement).getByRole('status', { name: label })
      ).toBeDefined();
    });
  }
);

describe('ImportFlow: an Import as held open', () => {
  const IMPORT = `${PROBLEMS}/p1/import`;

  it('imports once, and drops the row only once the hold is out', async () => {
    holding = (p, v) => p === IMPORT && v === 'POST';
    await review();

    fireEvent.click(
      screen.getByRole('button', { name: 'Import as “Ironwood (2018)”' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Import as “Ironwood (2018)”' })
    );
    // Shown at 300; the answer lands at 400; the hold runs to 800.
    await advanceClock(400);
    await respond(noContentResponse());

    await advanceClock(399);
    expect(screen.getByText(IRONWOOD.reason)).toBeDefined();

    await advanceClock(1);
    expect(screen.queryByText(IRONWOOD.reason)).toBeNull();
    expect(sentTo(IMPORT, 'POST')).toHaveLength(1);
  });
});

describe('ImportFlow: Resolve while another row is held', () => {
  it('opens the form as today, a plain link', async () => {
    const IMPORT = `${PROBLEMS}/p1/import`;
    holding = (p, v) => p === IMPORT && v === 'POST';
    await review();

    fireEvent.click(
      screen.getByRole('button', { name: 'Import as “Ironwood (2018)”' })
    );
    expect(busyRowOf(IRONWOOD.reason)).not.toBeNull();

    const resolve = within(rowOf(LANTERN.reason)).getByRole('link', {
      name: 'Resolve',
    });
    expect(resolve.getAttribute('href')).toBe('/add?problem=p5');
    fireEvent.click(resolve);

    expect(screen.getByText('the add form')).toBeDefined();
  });
});
