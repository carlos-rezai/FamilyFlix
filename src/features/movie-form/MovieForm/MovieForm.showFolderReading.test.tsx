import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { MovieForm } from './MovieForm';
import { theme } from '@/styles/theme';
import type { Genre } from '@/types';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';

/**
 * 69, Silent waits, Phase 5 (issue #660): _＋ Add show folder_ while the
 * **Show folder pick** reads.
 *
 * `useMovieForm` passes the pick's `reading` on as `readingShowFolder`. The
 * dashed row locks from `waiting`, `aria-busy`, and once `shown` draws the
 * 18px inline **Logo loader** reading _Reading folder…_. A refused read puts
 * the control back, its refusal sentence drawn under the form.
 *
 * The form's own reads are answered at once; the folder read is held by
 * `heldFetch`, the dialog is `fakeFolderBridge`.
 */

const POOL: Genre[] = ['Action', 'Drama'].map((name, index) => ({
  id: `g${index + 1}`,
  name,
}));

const SHOW = 'E:\\Shows\\Harbor and Vine';
const READING = 'Reading folder…';
const UNREADABLE = 'That folder can’t be read.';

const READ = {
  path: SHOW,
  title: 'Harbor and Vine',
  year: null,
  libraryFolderId: null,
  heldSeriesId: null,
  episodes: [
    {
      season: 1,
      number: 1,
      title: 'Pilot',
      relativePath: 'Season 1/Pilot.mkv',
      video: `${SHOW}\\Season 1\\Pilot.mkv`,
      subtitles: [],
    },
  ],
  unplaced: [],
  straySubtitles: 0,
};

/** A `400` carrying the route's one sentence. */
const refusedResponse = (error: string): Response =>
  ({
    ok: false,
    status: 400,
    json: () => Promise.resolve({ error }),
  }) as unknown as Response;

const { respond } = heldFetch((url) =>
  url.includes('/api/show-folder') ? undefined : okResponse({ genres: POOL })
);

afterEach(() => {
  vi.useRealTimers();
});

async function renderSeries() {
  render(
    <MemoryRouter initialEntries={['/add?kind=series']}>
      <ThemeProvider theme={theme}>
        <MovieForm />
      </ThemeProvider>
    </MemoryRouter>
  );
  await act(async () => undefined);
}

const addShowFolder = () =>
  screen.getByRole('button', {
    name: /add show folder|reading folder/i,
  }) as HTMLButtonElement;

/** Whether the control can't be pressed: inert, or disabled. */
const locked = (button: HTMLButtonElement) =>
  button.closest('[inert]') !== null || button.disabled;

describe('MovieForm: Add show folder while the folder reads', () => {
  const bridge = fakeFolderBridge();

  async function pressAndPick() {
    bridge.setPickOne(SHOW);
    vi.useFakeTimers();
    fireEvent.click(addShowFolder());
    await advanceClock(0);
  }

  it('locks from waiting, aria-busy, reading nothing yet', async () => {
    await renderSeries();
    await pressAndPick();

    const button = addShowFolder();
    expect(locked(button)).toBe(true);
    expect(button.closest('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText(READING)).toBeNull();

    await advanceClock(299);
    expect(screen.queryByText(READING)).toBeNull();
  });

  it('draws the 18px inline mark reading Reading folder… once shown', async () => {
    await renderSeries();
    await pressAndPick();

    await advanceClock(300);

    const loader = screen.getByRole('status', { name: READING });
    expect(loader.textContent).toContain(READING);
    expect(Number(loader.querySelector('svg')?.getAttribute('width'))).toBe(18);
    expect(locked(addShowFolder())).toBe(true);
  });

  it('is unlocked while the dialog is open, and locks once it answers', async () => {
    let answerDialog: (path: string | null) => void = () => undefined;
    vi.spyOn(bridge.folders, 'pickOne').mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          answerDialog = resolve;
        })
    );
    await renderSeries();
    vi.useFakeTimers();
    fireEvent.click(addShowFolder());
    await advanceClock(1000);

    const button = addShowFolder();
    expect(locked(button)).toBe(false);
    expect(button.closest('[aria-busy="true"]')).toBeNull();
    expect(screen.queryByText(READING)).toBeNull();

    await act(async () => answerDialog(SHOW));

    expect(locked(addShowFolder())).toBe(true);
  });

  it('reports no second press while the folder reads', async () => {
    await renderSeries();
    await pressAndPick();
    const opened = bridge.pickOnes();

    fireEvent.click(addShowFolder());
    await advanceClock(0);
    await advanceClock(300);
    fireEvent.click(addShowFolder());
    await advanceClock(0);

    expect(bridge.pickOnes()).toBe(opened);
  });

  it('puts the control back with its refusal sentence on a refused read', async () => {
    await renderSeries();
    await pressAndPick();
    await advanceClock(400);

    await respond(refusedResponse(UNREADABLE));
    await advanceClock(399);
    expect(locked(addShowFolder())).toBe(true);

    await advanceClock(1);

    const button = addShowFolder();
    expect(button.textContent).toContain('Add show folder');
    expect(locked(button)).toBe(false);
    expect(button.closest('[aria-busy="true"]')).toBeNull();
    expect(screen.queryByText(READING)).toBeNull();
    expect(screen.getByText(UNREADABLE)).toBeDefined();
  });
});
