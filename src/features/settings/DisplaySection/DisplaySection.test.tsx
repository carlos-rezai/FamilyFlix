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
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
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
  settingsRead = { subtitleLanguage: 'English', ultrawideMargins: false };
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
    settingsRead = { subtitleLanguage: 'English', ultrawideMargins: true };
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
    settingsRead = { subtitleLanguage: 'English', ultrawideMargins: true };
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
