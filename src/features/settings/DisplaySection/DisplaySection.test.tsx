import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { DisplaySection } from './DisplaySection';
import { DisplayPreferenceProvider } from '@/App/DisplayPreferenceProvider/DisplayPreferenceProvider';
import type { Settings } from '@/types';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { makeSettings } from '@/test-support/makeSettings/makeSettings';
import * as sectionStyles from '../section.styles';
import * as playbackStyles from '../PlaybackSection/PlaybackSection.styles';

/**
 * 27 — Ultrawide margins, Phase 1 (issue #249).
 *
 * The **Display group**: the `Display` **Group heading** over one **Section
 * card** holding a single row — _Ultrawide margins_, its line, and the
 * `Toggle` on the right, `label="Ultrawide margins"`, reading and writing
 * through `useDisplayPreference`. While the value is `null` the Toggle is not
 * drawn — **Blank until it lands**.
 *
 * Rendered under the real `DisplayPreferenceProvider` over a stubbed `fetch`,
 * so "a press writes through the provider" is asserted as the post it makes.
 */

const SETTINGS_ROUTE = '/api/settings';
const WRITE_ROUTE = '/api/settings/ultrawide-margins';
const TMDB_ROUTE = '/api/settings/tmdb-ratings';

const LINE =
  'Keep everything in the middle of a very wide screen, so the rows fit without turning your head. Smaller screens look the same either way.';

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

/** What the settings read answers: `'held'` never answers. */
let settingsRead: Settings | 'held';

beforeEach(() => {
  settingsRead = makeSettings();
  fetchMock = vi
    .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
    .mockImplementation((input, init) => {
      const url = String(input);
      if (url === SETTINGS_ROUTE) {
        return settingsRead === 'held'
          ? new Promise<Response>(() => undefined)
          : Promise.resolve(okResponse(settingsRead));
      }
      if (url === WRITE_ROUTE && init?.method === 'POST') {
        const { value } = JSON.parse(String(init.body)) as { value: boolean };
        return Promise.resolve(okResponse({ value }));
      }
      if (url === TMDB_ROUTE && init?.method === 'POST') {
        const { value } = JSON.parse(String(init.body)) as { value: boolean };
        // The server keeps what it was sent, so the next read answers it.
        if (settingsRead !== 'held') {
          settingsRead = { ...settingsRead, tmdbRatings: value };
        }
        return Promise.resolve(okResponse({ value }));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderSection() {
  return render(
    <ThemeProvider theme={theme}>
      <DisplayPreferenceProvider>
        <DisplaySection />
      </DisplayPreferenceProvider>
    </ThemeProvider>
  );
}

/** The posts issued so far, as the values their bodies carried. */
function postedValues(): unknown[] {
  return fetchMock.mock.calls
    .filter(
      ([input, init]) =>
        String(input) === WRITE_ROUTE && init?.method === 'POST'
    )
    .map(
      ([, init]) => (JSON.parse(String(init?.body)) as { value: unknown }).value
    );
}

const toggle = () => screen.findByRole('switch', { name: 'Ultrawide margins' });

describe('DisplaySection — the copy', () => {
  it('draws the Display heading over the row’s title and line, verbatim', () => {
    renderSection();

    const heading = screen.getByText('Display');
    const title = screen.getByText('Ultrawide margins');
    const line = screen.getByText(LINE);

    expect(getComputedStyle(heading).textTransform).toBe('uppercase');
    expect(comesBefore(heading, title)).toBe(true);
    expect(comesBefore(title, line)).toBe(true);
  });
});

describe('DisplaySection — the Toggle', () => {
  it('is not drawn while the value is null', () => {
    settingsRead = 'held';
    renderSection();

    expect(screen.getByText('Ultrawide margins')).toBeDefined();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('is a switch named Ultrawide margins, off when the stored value is off', async () => {
    renderSection();

    expect((await toggle()).getAttribute('aria-checked')).toBe('false');
  });

  it('reads on when the stored value is on', async () => {
    settingsRead = makeSettings({ ultrawideMargins: true });
    renderSection();

    expect((await toggle()).getAttribute('aria-checked')).toBe('true');
  });

  it('writes through the provider when pressed, and reflects the new value', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(await toggle());

    expect((await toggle()).getAttribute('aria-checked')).toBe('true');
    await waitFor(() => expect(postedValues()).toEqual([true]));
  });

  it('writes false when pressed from on', async () => {
    settingsRead = makeSettings({ ultrawideMargins: true });
    const user = userEvent.setup();
    renderSection();

    await user.click(await toggle());

    expect((await toggle()).getAttribute('aria-checked')).toBe('false');
    await waitFor(() => expect(postedValues()).toEqual([false]));
  });
});

/**
 * The row furniture's second caller: `Row`, `RowTitle` and `RowDesc` move up
 * out of the Playback section's styles into the shared `section.styles`, and
 * both sections import them from there — "written twice, extracted once".
 */
describe('the Setting row furniture — exported once, shared', () => {
  const FURNITURE = ['Row', 'RowTitle', 'RowDesc'] as const;
  const source = (path: string) =>
    readFileSync(
      // Joined by `node:path`, not `new URL(`../${path}`, import.meta.url)`:
      // Vite rewrites that dynamic-template shape as an asset glob, and the
      // path comes out `undefined`.
      join(dirname(fileURLToPath(import.meta.url)), '..', path),
      'utf8'
    );

  it('is exported from the shared section styles', () => {
    for (const name of FURNITURE) {
      expect(sectionStyles).toHaveProperty(name);
    }
  });

  it('is no longer exported from the Playback section’s styles', () => {
    for (const name of FURNITURE) {
      expect(playbackStyles).not.toHaveProperty(name);
    }
  });

  it.each([
    'PlaybackSection/PlaybackSection.tsx',
    'DisplaySection/DisplaySection.tsx',
  ])('is imported by %s from the shared section styles', (path) => {
    const imports = source(path).match(
      /import\s*\{([^}]*)\}\s*from\s*'\.\.\/section\.styles'/
    );

    expect(imports).not.toBeNull();
    const names = (imports?.[1] ?? '').split(',').map((name) => name.trim());
    for (const name of FURNITURE) {
      expect(names).toContain(name);
    }
  });
});

/**
 * 43 — TMDB ratings, Phase 1 (issue #369).
 *
 * The Display card's second row, _Fill in ratings from TMDB_, on the same
 * `Row` furniture and `Toggle` as _Ultrawide margins_ and under it: its title,
 * its line, and the switch named for the title, reading and writing
 * `tmdbRatings` through `useDisplayPreference`. Not drawn while `null` —
 * **Blank until it lands**.
 */
const TMDB_TITLE = 'Fill in ratings from TMDB';
const TMDB_LINE =
  "When the family hasn't rated a title, show TMDB's score as its stars, marked TMDB. Your own ratings always come first.";

/** The posts issued to the tmdb-ratings route so far. */
function postedTmdbValues(): unknown[] {
  return fetchMock.mock.calls
    .filter(
      ([input, init]) => String(input) === TMDB_ROUTE && init?.method === 'POST'
    )
    .map(
      ([, init]) => (JSON.parse(String(init?.body)) as { value: unknown }).value
    );
}

const tmdbToggle = () => screen.findByRole('switch', { name: TMDB_TITLE });

describe('DisplaySection — Fill in ratings from TMDB, the copy', () => {
  it('draws the second row’s title and line, verbatim, under Ultrawide margins', () => {
    renderSection();

    const first = screen.getByText('Ultrawide margins');
    const title = screen.getByText(TMDB_TITLE);
    const line = screen.getByText(TMDB_LINE);

    expect(comesBefore(first, title)).toBe(true);
    expect(comesBefore(title, line)).toBe(true);
  });

  it('draws the title on the same row furniture as Ultrawide margins', () => {
    renderSection();

    const first = screen.getByText('Ultrawide margins');
    const title = screen.getByText(TMDB_TITLE);

    expect(title.tagName).toBe(first.tagName);
    expect(title.className).toBe(first.className);
  });
});

describe('DisplaySection — Fill in ratings from TMDB, the Toggle', () => {
  it('is not drawn while the value is null', () => {
    settingsRead = 'held';
    renderSection();

    expect(screen.getByText(TMDB_TITLE)).toBeDefined();
    expect(screen.queryByRole('switch', { name: TMDB_TITLE })).toBeNull();
  });

  it('is a switch named for the row, on when the stored value is on', async () => {
    renderSection();

    expect((await tmdbToggle()).getAttribute('aria-checked')).toBe('true');
  });

  it('reads off when the stored value is off', async () => {
    settingsRead = makeSettings({ tmdbRatings: false });
    renderSection();

    expect((await tmdbToggle()).getAttribute('aria-checked')).toBe('false');
  });

  it('writes false through the provider when pressed from on, and reflects it', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(await tmdbToggle());

    expect((await tmdbToggle()).getAttribute('aria-checked')).toBe('false');
    await waitFor(() => expect(postedTmdbValues()).toEqual([false]));
    expect(postedValues()).toEqual([]);
  });

  it('writes true when pressed from off', async () => {
    settingsRead = makeSettings({ tmdbRatings: false });
    const user = userEvent.setup();
    renderSection();

    await user.click(await tmdbToggle());

    expect((await tmdbToggle()).getAttribute('aria-checked')).toBe('true');
    await waitFor(() => expect(postedTmdbValues()).toEqual([true]));
  });

  it('leaves the Ultrawide margins switch as it was', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(await tmdbToggle());

    expect((await toggle()).getAttribute('aria-checked')).toBe('false');
  });

  it('survives a reload — the next mount reads back what was written', async () => {
    const user = userEvent.setup();
    const first = renderSection();
    await user.click(await tmdbToggle());
    await waitFor(() => expect(postedTmdbValues()).toEqual([false]));
    first.unmount();

    renderSection();

    expect((await tmdbToggle()).getAttribute('aria-checked')).toBe('false');
  });
});

/**
 * 49, Start on Series, Phase 5 (issue #430).
 *
 * The Display card's third row, _Start on_: its title, its line, and the
 * **Pill tabs** (`Movies`, `Series`) on the right, a group named for the
 * title, reading and writing the **Start tab** through
 * `useDisplayPreference`. Not drawn while `startTab` is `null`: **Blank
 * until it lands**. A refused save puts the old pill back; no snackbar on
 * either outcome. The row knows nothing of the library, so an empty one
 * draws it all the same.
 */
const START_ROUTE = '/api/settings/start-tab';
const START_TITLE = 'Start on';
const START_LINE =
  'Which shelf FamilyFlix opens on. You can still switch between Movies and Series at the top of the library.';

/** Wraps the shared stub so the start-tab route answers, or refuses. */
function answerStartTab(outcome: 'keep' | 'refuse') {
  const base = fetchMock.getMockImplementation();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (url === START_ROUTE && init?.method === 'POST') {
      if (outcome === 'refuse') {
        return Promise.resolve(serverErrorResponse());
      }
      const { value } = JSON.parse(String(init.body)) as { value: string };
      return Promise.resolve(okResponse({ value }));
    }
    if (url.startsWith('/api/movies') || url.startsWith('/api/series')) {
      return Promise.resolve(okResponse([]));
    }
    return base
      ? base(input, init)
      : Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

/** The posts issued to the start-tab route so far. */
function postedStartTabs(): unknown[] {
  return fetchMock.mock.calls
    .filter(
      ([input, init]) =>
        String(input) === START_ROUTE && init?.method === 'POST'
    )
    .map(
      ([, init]) => (JSON.parse(String(init?.body)) as { value: unknown }).value
    );
}

const pill = (name: 'Movies' | 'Series') =>
  screen.findByRole('button', { name });

const pressed = async (name: 'Movies' | 'Series') =>
  (await pill(name)).getAttribute('aria-pressed');

describe('DisplaySection: Start on, the copy', () => {
  it('draws the third row’s title and line, verbatim, under Fill in ratings from TMDB', () => {
    renderSection();

    const tmdbLine = screen.getByText(TMDB_LINE);
    const title = screen.getByText(START_TITLE);
    const line = screen.getByText(START_LINE);

    expect(comesBefore(tmdbLine, title)).toBe(true);
    expect(comesBefore(title, line)).toBe(true);
  });

  it('draws the title on the same row furniture as the other rows', () => {
    renderSection();

    const first = screen.getByText('Ultrawide margins');
    const title = screen.getByText(START_TITLE);

    expect(title.tagName).toBe(first.tagName);
    expect(title.className).toBe(first.className);
  });
});

describe('DisplaySection: Start on, the Pill tabs', () => {
  it('draws no pills while the read is pending', () => {
    settingsRead = 'held';
    renderSection();

    expect(screen.getByText(START_TITLE)).toBeDefined();
    expect(screen.queryByRole('group', { name: START_TITLE })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Movies' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Series' })).toBeNull();
  });

  it('is a group named Start on with the stored Movies pill pressed', async () => {
    renderSection();

    expect(
      await screen.findByRole('group', { name: START_TITLE })
    ).toBeDefined();
    expect(await pressed('Movies')).toBe('true');
    expect(await pressed('Series')).toBe('false');
  });

  it('presses the Series pill when Series is stored', async () => {
    settingsRead = makeSettings({ startTab: 'series' });
    renderSection();

    expect(await pressed('Series')).toBe('true');
    expect(await pressed('Movies')).toBe('false');
  });

  it('posts the other pill when pressed, and presses it', async () => {
    answerStartTab('keep');
    const user = userEvent.setup();
    renderSection();

    await user.click(await pill('Series'));

    expect(await pressed('Series')).toBe('true');
    expect(await pressed('Movies')).toBe('false');
    await waitFor(() => expect(postedStartTabs()).toEqual(['series']));
  });

  it('presses the old pill again when the save is refused', async () => {
    answerStartTab('refuse');
    const user = userEvent.setup();
    renderSection();

    await user.click(await pill('Series'));

    await waitFor(() => expect(postedStartTabs()).toEqual(['series']));
    await waitFor(async () => expect(await pressed('Movies')).toBe('true'));
    expect(await pressed('Series')).toBe('false');
  });

  it.each(['keep', 'refuse'] as const)(
    'shows no snackbar when the save is answered %s',
    async (outcome) => {
      answerStartTab(outcome);
      const user = userEvent.setup();
      renderSection();

      await user.click(await pill('Series'));
      await waitFor(() => expect(postedStartTabs()).toEqual(['series']));
      await waitFor(async () =>
        expect(await pressed(outcome === 'keep' ? 'Series' : 'Movies')).toBe(
          'true'
        )
      );

      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    }
  );

  it('draws the row with an empty library', async () => {
    answerStartTab('keep');
    renderSection();

    expect(screen.getByText(START_TITLE)).toBeDefined();
    expect(screen.getByText(START_LINE)).toBeDefined();
    expect(await pressed('Movies')).toBe('true');
  });
});
