import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import SettingsPage from './SettingsPage';
import type { PlaybackCapabilities, Settings, StorageReport } from '@/types';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';

/** The **Codec report** the Playback card reads on mount. */
const REPORT: PlaybackCapabilities = {
  component: true,
  codecs: [
    { codec: 'h264', kind: 'video', support: 'native' },
    { codec: 'hevc', kind: 'video', support: 'via-component' },
  ],
};

/** The household's settings the Playback card's Subtitles half reads. */
const SETTINGS: Settings = { subtitleLanguage: 'English' };

/** The **Storage report** the Storage card reads on mount. */
const STORAGE: StorageReport = {
  mediaPath: 'D:\\FamilyFlix\\media',
  bytesUsed: 19_756_849_562,
  movieCount: 12,
};

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  // The cards ask for their reads on mount; the page's tests are not about
  // what they say, so every route answers a small one, by URL.
  fetchMock = vi
    .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
    .mockImplementation((input) => {
      const url = String(input);
      if (url === '/api/settings') {
        return Promise.resolve(okResponse(SETTINGS));
      }
      if (url === '/api/storage') {
        return Promise.resolve(okResponse(STORAGE));
      }
      return Promise.resolve(okResponse(REPORT));
    });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <ThemeProvider theme={theme}>
        <SettingsPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

const header = () => screen.getByRole('heading', { name: 'Settings' });
const importRow = () =>
  screen.getByRole('button', { name: /import from spreadsheet/i });

/**
 * `/settings` — composition only. What the header does — where Back goes,
 * what ＋ Add a movie opens — is tested where it lives, in
 * `features/settings/SettingsHeader`; what the Library section's rows open,
 * in `features/settings/LibrarySection`; what the Playback card draws, in
 * `features/settings/PlaybackSection`.
 *
 * 15 — Settings hub, Phase 1: "the tracer bullet" (issue #143) composes the
 * second **Settings group**: `Playback` under `Library`, at the same measure,
 * with the Library rows exactly as before. Phase 4: "the Storage card" (issue
 * #146) composes the third, `Storage` under `Playback` — LIBRARY, PLAYBACK,
 * STORAGE in order; what the card draws is `features/settings/StorageSection`'s.
 * Phase 5: "the About card" (issue #147) composes the fourth and last, `About`
 * under `Storage` — the whole page the prototype draws, and nothing else.
 */
describe('SettingsPage', () => {
  it('composes the settings header in the maintainer sheet', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeDefined();
    // By its exact name: the Library section under it carries a second
    // "Add a movie", the row, whose name runs on into its line.
    expect(screen.getByRole('button', { name: 'Add a movie' })).toBeDefined();
  });

  it('composes the Library section under the header', () => {
    renderPage();

    // 13 — Bulk import, Phase 2 (issue #125): the first of the grouped
    // sections, because both of its destinations now exist.
    expect(screen.getByText('Library')).toBeDefined();
    expect(
      screen.getByRole('button', { name: /import from spreadsheet/i })
    ).toBeDefined();
    expect(comesBefore(header(), importRow())).toBe(true);
  });

  it('composes the Playback section under the Library section', () => {
    renderPage();

    // 15 — Settings hub, Phase 1 (issue #143): the second of the grouped
    // sections, a Section card headed Codecs over the Codec report.
    expect(screen.getByText('Playback')).toBeDefined();
    expect(screen.getByText('Codecs')).toBeDefined();
    expect(
      comesBefore(screen.getByText('Library'), screen.getByText('Playback'))
    ).toBe(true);
    expect(comesBefore(importRow(), screen.getByText('Playback'))).toBe(true);
  });

  it('draws the codec report on the page once it lands', async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/formats enabled/)).toBeDefined()
    );
    expect(screen.getByText('H.264 / AVC')).toBeDefined();
    expect(screen.getByText('Built-in')).toBeDefined();
    expect(screen.getByText('Installed')).toBeDefined();
  });

  it('keeps the Library rows exactly as before, with the Playback card under them', () => {
    renderPage();

    // Back, two "Add a movie"s — the header's and the row's — then the two
    // rows the Library group always had: five buttons, and the Playback card
    // adds none of its own.
    expect(screen.getByText('Codecs')).toBeDefined();
    expect(
      screen.getAllByRole('button', { name: /add a movie/i })
    ).toHaveLength(2);
    expect(importRow()).toBeDefined();
    expect(
      screen.getByRole('button', { name: /export to csv/i })
    ).toBeDefined();
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('composes the Storage section under the Playback section', () => {
    renderPage();

    // 15 — Settings hub, Phase 4 (issue #146): the third of the grouped
    // sections, a Section card headed Managed media folder over the report.
    expect(screen.getByText('Storage')).toBeDefined();
    expect(screen.getByText('Managed media folder')).toBeDefined();
    expect(
      comesBefore(screen.getByText('Playback'), screen.getByText('Storage'))
    ).toBe(true);
    expect(
      comesBefore(
        screen.getByText('Preferred language'),
        screen.getByText('Storage')
      )
    ).toBe(true);
  });

  it('shows LIBRARY, PLAYBACK, STORAGE, ABOUT in order', () => {
    renderPage();

    const headings = ['Library', 'Playback', 'Storage', 'About'].map((name) =>
      screen.getByText(name)
    );
    for (const heading of headings) {
      expect(getComputedStyle(heading).textTransform).toBe('uppercase');
    }
    expect(comesBefore(headings[0], headings[1])).toBe(true);
    expect(comesBefore(headings[1], headings[2])).toBe(true);
    expect(comesBefore(headings[2], headings[3])).toBe(true);
  });

  it('draws the storage report on the page once it lands', async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(STORAGE.mediaPath)).toBeDefined()
    );
    expect(screen.getByText('18.4 GB')).toBeDefined();
    expect(screen.getByText(/12 titles/)).toBeDefined();
  });

  it('adds no button of its own with the Storage card — no Change…', async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(STORAGE.mediaPath)).toBeDefined()
    );
    expect(screen.queryByRole('button', { name: /change/i })).toBeNull();
    // Back, two "Add a movie"s, Import, Export — and the Preferred language
    // pill once the settings land; the Storage card adds none.
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /^Preferred language: / })
      ).toBeDefined()
    );
    expect(screen.getAllByRole('button')).toHaveLength(6);
  });

  it('composes the About section under the Storage section', () => {
    renderPage();

    // 15 — Settings hub, Phase 5 (issue #147): the fourth and last of the
    // grouped sections, a Section card holding the brand row.
    expect(screen.getByText('About')).toBeDefined();
    expect(screen.getByText('Family')).toBeDefined();
    expect(screen.getByText('Flix')).toBeDefined();
    expect(
      comesBefore(screen.getByText('Storage'), screen.getByText('About'))
    ).toBe(true);
    expect(
      comesBefore(
        screen.getByText('Managed media folder'),
        screen.getByText('About')
      )
    ).toBe(true);
  });

  it('draws the defined version and the tagline on the page', () => {
    renderPage();

    expect(screen.getByText(__APP_VERSION__)).toBeDefined();
    expect(screen.getByText('Offline · local-only · no account')).toBeDefined();
  });

  it('composes the five sections and nothing else', async () => {
    renderPage();

    // No Software update row: the About card adds no button and no copy
    // about an updater the app does not have.
    expect(screen.queryByText(/software update/i)).toBeNull();
    expect(screen.queryByText(/up to date/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /update/i })).toBeNull();
    // Back, two "Add a movie"s, Import, Export — and the Preferred language
    // pill once the settings land; About adds none.
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /^Preferred language: / })
      ).toBeDefined()
    );
    expect(screen.getAllByRole('button')).toHaveLength(6);
    // Four Group headings, and only four.
    const groupHeadings = ['Library', 'Playback', 'Storage', 'About'].map(
      (name) => screen.getByText(name)
    );
    const uppercased = Array.from(document.body.querySelectorAll('div')).filter(
      (element) =>
        getComputedStyle(element).textTransform === 'uppercase' &&
        element.children.length === 0
    );
    expect(uppercased).toEqual(groupHeadings);
  });
});
