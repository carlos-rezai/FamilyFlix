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
 * 69, Silent waits, the walk (issue #661): _Skip all_ on a **Review group**.
 *
 * The walk found the group's _Skip all_ locked its rows but drew no busy face
 * of its own, while _Skip all_ beside a chosen kind read _Skipping…_ for a
 * press it never had. Held open, the group's _Skip all_ is a Busy button:
 * locked at once, so a second press sends nothing, and reading _Skipping…_
 * past 300ms; it alone reads it. Its rows leave only once the hold is out.
 *
 * _Keep all mine_ beside a chosen `differs` is the same bulk Dismiss under
 * the row's own word for it, and reads what the row's _Keep all mine_ reads:
 * _Skipping…_.
 *
 * The review is read on real timers; the clock is faked from the press on.
 */

const noFolder = (id: string, title: string): ImportProblem => ({
  id,
  kind: 'no-folder',
  title,
  reason: `Reason ${id}.`,
});

const differs = (id: string, title: string): ImportProblem => ({
  id,
  kind: 'differs',
  title,
  reason: `Reason ${id}.`,
  movieId: `m-${id}`,
  differences: [
    { field: 'director', label: 'Director', mine: 'Mine', sheet: 'Sheet' },
  ],
});

const PROBLEMS: ImportProblem[] = [
  noFolder('f1', 'The Night Ferry'),
  {
    id: 'l1',
    kind: 'no-row',
    title: 'Ironwood (2018)',
    reason: 'Reason l1.',
    guess: 'Ironwood (2018)',
  },
  noFolder('f3', 'The Night Ferry'),
  differs('d1', 'Die Hard'),
  differs('d2', 'Heat'),
];

const reviewOf = (problems: ImportProblem[], matched = 2): ImportRun =>
  makeImportRun({
    phase: 'review',
    found: 9,
    total: matched,
    done: matched,
    matched,
    problems,
  });

/** What the dismiss echoes: the group's rows settled. */
const ECHO = reviewOf(
  PROBLEMS.filter((p) => p.title !== 'The Night Ferry'),
  2
);

const pathOf = (url: string) => new URL(url, 'http://localhost').pathname;
const verbOf = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();

const BULK_DISMISS = '/api/import/current/problems/dismiss';

/** Every read answered at once; only the dismiss is held open. */
const { fetchMock, respond } = heldFetch((url, init) => {
  const p = pathOf(url);
  if (verbOf(init) === 'POST' && p === BULK_DISMISS) return undefined;
  if (p === '/api/import/current') return okResponse(reviewOf(PROBLEMS));
  if (p === '/api/library-folders') return okResponse([]);
  if (p === '/api/tmdb/key') return okResponse({ key: null });
  return notFoundResponse('Not found');
});

afterEach(() => {
  vi.useRealTimers();
});

const sent = () =>
  fetchMock.mock.calls.filter(
    ([input, init]) =>
      pathOf(String(input)) === BULK_DISMISS && verbOf(init) === 'POST'
  );

const GROUP_SKIP = 'Skip all for The Night Ferry';
const groupSkip = () =>
  screen.getByRole('button', { name: GROUP_SKIP }) as HTMLButtonElement;
const filter = () =>
  screen.getByRole('group', { name: 'Problem kinds' }) as HTMLElement;
const besideFilter = () => filter().parentElement?.parentElement as HTMLElement;

/** The review drawn, _No folder_ chosen, the clock faked, the group's Skip all pressed. */
async function pressedOnGroup() {
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
  await screen.findByText('Ironwood (2018)');
  fireEvent.click(
    within(filter()).getByRole('button', { name: 'No folder 2' })
  );
  vi.useFakeTimers();
  fireEvent.click(groupSkip());
}

describe('ImportFlow: Skip all on a Review group as a Busy button', () => {
  it('locks at once, so a second press sends nothing', async () => {
    await pressedOnGroup();

    expect(sent()).toHaveLength(1);
    expect(groupSkip().getAttribute('aria-busy')).toBe('true');
    expect(groupSkip().disabled).toBe(true);

    fireEvent.click(groupSkip());
    await advanceClock(0);
    expect(sent()).toHaveLength(1);

    await respond(okResponse(ECHO));
    await advanceClock(500);
  });

  it('reads Skipping… past 300ms, and the Skip all beside the filter does not', async () => {
    await pressedOnGroup();

    await advanceClock(299);
    expect(groupSkip().textContent).toBe('Skip all');
    await advanceClock(1);
    expect(groupSkip().textContent).toBe('Skipping…');
    expect(
      within(besideFilter()).getByRole('button', { name: 'Skip all' })
        .textContent
    ).toBe('Skip all');

    await respond(okResponse(ECHO));
    await advanceClock(500);
  });

  it('sends once, and the group leaves only once the hold is out', async () => {
    await pressedOnGroup();

    // Shown at 300; the echo lands at 400; the hold runs to 800.
    await advanceClock(400);
    await respond(okResponse(ECHO));

    await advanceClock(399);
    expect(screen.queryByRole('button', { name: GROUP_SKIP })).not.toBeNull();

    await advanceClock(1);
    expect(screen.queryByRole('button', { name: GROUP_SKIP })).toBeNull();
    expect(sent()).toHaveLength(1);
  });
});

describe('ImportFlow: Keep all mine beside differs as a Busy button', () => {
  const keepAll = () =>
    within(besideFilter()).getByRole('button', {
      name: 'Keep all mine',
    }) as HTMLButtonElement;

  it('locks at once and reads Skipping… past 300ms', async () => {
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
    await screen.findByText('Ironwood (2018)');
    fireEvent.click(
      within(filter()).getByRole('button', { name: 'Differs 2' })
    );
    vi.useFakeTimers();
    const button = keepAll();
    fireEvent.click(button);

    expect(sent()).toHaveLength(1);
    expect(button.getAttribute('aria-busy')).toBe('true');
    await advanceClock(299);
    expect(button.textContent).toBe('Keep all mine');
    await advanceClock(1);
    expect(button.textContent).toBe('Skipping…');

    await respond(okResponse(reviewOf([PROBLEMS[1]], 2)));
    await advanceClock(500);
  });
});
