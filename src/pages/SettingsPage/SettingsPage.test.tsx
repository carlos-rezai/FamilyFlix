import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import SettingsPage from './SettingsPage';
import type { PlaybackCapabilities } from '@/types';
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

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  // The Playback card asks for the report on mount; the page's tests are
  // not about what it says, so every read answers a small one.
  fetchMock = vi
    .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
    .mockResolvedValue(okResponse(REPORT));
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
 * with the Library rows exactly as before.
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

  it('builds none of the other sections yet', () => {
    renderPage();

    // Storage and About are later phases of the settings-hub initiative.
    for (const section of ['Storage', 'About']) {
      expect(screen.queryByText(section)).toBeNull();
    }
  });
});
