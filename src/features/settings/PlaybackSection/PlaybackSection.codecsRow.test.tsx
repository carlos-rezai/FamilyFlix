import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { PlaybackSection } from './PlaybackSection';
import { NetworkSection } from '../NetworkSection/NetworkSection';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import { MicrochipIcon } from '@/primitives';
import type { EnrichmentSummary, PlaybackCapabilities } from '@/types';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import {
  LocationProbe,
  navigationType,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 26 — Codecs page, Phase 2: "the Settings card" (issue #245).
 *
 * In the Playback card, the _Codecs_ title, its lede and the **Codec report**
 * give way to one **Codecs row**, drawn through `NavigationRow` as the Network
 * group's _Sync metadata & posters_ row is. This suite proves what the section
 * hands the molecule — the microchip, _Codecs_, the **Codec summary** of
 * `GET /api/playback/capabilities` as its line (blank until the read lands,
 * blank still after a refusal), and `/settings/codecs` — and leaves what every
 * row is (a button, its chevron, its keys) to `NavigationRow.test.tsx`. The
 * Subtitles half stays under it, as it was.
 *
 * The round trip — an upload on the **Codecs page**, Back, and the new summary
 * in this row — is the App suite's, because it crosses two screens.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

const CAPABILITIES_ROUTE = '/api/playback/capabilities';

/** A machine with the Default component: one native row, one it adds. */
const REPORT: PlaybackCapabilities = {
  component: {
    source: 'default',
    bytes: 98_765_432,
    files: ['ffmpeg.exe', 'ffprobe.exe'],
  },
  codecs: [
    { codec: 'h264', kind: 'video', support: 'native' },
    { codec: 'hevc', kind: 'video', support: 'via-component' },
  ],
};

/** A machine with no component at all. */
const BARE: PlaybackCapabilities = {
  component: null,
  codecs: [
    { codec: 'h264', kind: 'video', support: 'native' },
    { codec: 'vp9', kind: 'video', support: 'native' },
  ],
};

const SUMMARY: EnrichmentSummary = {
  total: 480,
  complete: 412,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryRoot: null,
};

/** How the capabilities read answers; the other reads always land. */
let answerCapabilities: () => Promise<Response>;

beforeEach(() => {
  answerCapabilities = () => Promise.resolve(okResponse(REPORT));
  fetchMock = vi.fn<FetchFn>().mockImplementation((input) => {
    const path = new URL(String(input), 'http://localhost').pathname;
    if (path === CAPABILITIES_ROUTE) {
      return answerCapabilities();
    }
    if (path === '/api/settings') {
      return Promise.resolve(okResponse({ subtitleLanguage: 'English' }));
    }
    if (path === '/api/enrichment') {
      return Promise.resolve(okResponse(SUMMARY));
    }
    if (path === '/api/tmdb/key') {
      return Promise.resolve(okResponse({ key: null }));
    }
    return Promise.reject(new Error(`unexpected request: ${path}`));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderSection() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/settings" element={<PlaybackSection />} />
          <Route path="/settings/codecs" element={<p>the codecs page</p>} />
        </Routes>
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
}

/** The one Codecs row, by the name its label opens. */
const codecsRow = () => screen.getByRole('button', { name: /^Codecs/ });

/** The row's line: the second span of its text block. */
function lineOf(row: HTMLElement): HTMLElement {
  const line = row.children[1]?.children[1];
  if (!(line instanceof HTMLElement)) {
    throw new Error('the row has no line under its label');
  }
  return line;
}

const LINE = '2 formats enabled · 1 from the playback component';

/** The report, landed in the row's line. */
const lineLanded = (text = LINE) =>
  waitFor(() => expect(lineOf(codecsRow()).textContent).toBe(text));

/** Every request made to one route, by path. */
const callsTo = (path: string) =>
  fetchMock.mock.calls.filter(
    ([input]) => new URL(String(input), 'http://localhost').pathname === path
  );

describe('PlaybackSection — no report on Settings', () => {
  it('draws no codec rows, no drop zone and no Codecs lede', async () => {
    const { container } = renderSection();
    await lineLanded();

    expect(screen.queryByText('H.264 / AVC')).toBeNull();
    expect(screen.queryByText('H.265 / HEVC')).toBeNull();
    expect(screen.queryByText('Add a codec pack')).toBeNull();
    expect(screen.queryByText(/drop a playback component/i)).toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(
      screen.queryByText(/These decide which video files FamilyFlix can play/)
    ).toBeNull();
  });
});

describe('PlaybackSection — the Codecs row', () => {
  it('holds one button named for Codecs', async () => {
    renderSection();
    await lineLanded();

    expect(screen.getAllByRole('button', { name: /^Codecs/ })).toHaveLength(1);
    expect(screen.getByText('Codecs').closest('button')).toBe(codecsRow());
  });

  it('carries the microchip glyph in its tile', async () => {
    renderSection();
    await lineLanded();

    const glyph = render(<MicrochipIcon size={19} />).container.querySelector(
      'svg'
    );
    const row = codecsRow();

    expect(row.firstElementChild?.querySelector('svg')?.innerHTML).toBe(
      glyph?.innerHTML
    );
  });

  it('reads the Codec summary of the fetched report as its line', async () => {
    renderSection();

    await lineLanded(LINE);
    expect(callsTo(CAPABILITIES_ROUTE)).toHaveLength(1);
  });

  it('reads “no playback component” when the report has none', async () => {
    answerCapabilities = () => Promise.resolve(okResponse(BARE));
    renderSection();

    await lineLanded('2 formats enabled · no playback component');
  });

  it('keeps the line blank while the read is pending', async () => {
    answerCapabilities = () => new Promise<Response>(() => undefined);
    renderSection();

    await waitFor(() => expect(callsTo(CAPABILITIES_ROUTE)).toHaveLength(1));
    expect(lineOf(codecsRow()).textContent).toBe('');
    expect(codecsRow().textContent).toBe('Codecs');
  });

  it('keeps the line blank after a refused read, with no error face', async () => {
    answerCapabilities = () => Promise.resolve(serverErrorResponse());
    renderSection();

    await waitFor(() => expect(callsTo(CAPABILITIES_ROUTE)).toHaveLength(1));
    await act(async () => {
      await Promise.resolve();
    });
    expect(lineOf(codecsRow()).textContent).toBe('');
    expect(codecsRow().textContent).toBe('Codecs');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.queryByText(/couldn.t|could not|error|failed|try again/i)
    ).toBeNull();
  });
});

describe('PlaybackSection — pressing the Codecs row', () => {
  it('pushes /settings/codecs on a click', async () => {
    renderSection();
    await lineLanded();

    fireEvent.click(codecsRow());

    expect(await screen.findByText('the codecs page')).toBeDefined();
    expect(pathname()).toBe('/settings/codecs');
    expect(navigationType()).toBe('PUSH');
  });
});

describe('PlaybackSection — the Subtitles half under the row', () => {
  it('draws the divider, Subtitles, the Coming soon toggle and Preferred language after the row', async () => {
    const { container } = renderSection();
    await lineLanded();
    await screen.findByRole('button', { name: 'Preferred language: English' });

    const row = codecsRow();
    const divider = Array.from(container.querySelectorAll('div')).find(
      (element) =>
        getComputedStyle(element).height === '1px' &&
        element.childElementCount === 0 &&
        comesBefore(row, element) &&
        comesBefore(element, screen.getByText('Subtitles'))
    );
    expect(divider).toBeDefined();
    expect(
      comesBefore(
        screen.getByText('Subtitles'),
        screen.getByText('Coming soon')
      )
    ).toBe(true);
    expect(
      screen
        .getByRole('switch', { name: 'Turn on automatically' })
        .getAttribute('aria-disabled')
    ).toBe('true');
    expect(
      comesBefore(
        screen.getByText('Coming soon'),
        screen.getByText('Preferred language')
      )
    ).toBe(true);
    expect(screen.getAllByText('Playback')).toHaveLength(1);
  });
});

describe('PlaybackSection — the read alone', () => {
  it('sends nothing to the component route', async () => {
    renderSection();
    await lineLanded();

    fireEvent.click(codecsRow());
    await screen.findByText('the codecs page');

    expect(callsTo('/api/playback/component')).toEqual([]);
  });
});

/** Every property the cascade resolved for one element, as a plain record. */
function resolved(element: Element): Record<string, string> {
  const style = getComputedStyle(element);
  const entries: Record<string, string> = {};
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index);
    entries[property] = style.getPropertyValue(property);
  }
  return entries;
}

/** The six parts of a Settings row: button, tile, text, label, line, chevron. */
function partsOf(row: HTMLElement): Record<string, Element> {
  const [tile, text, chevron] = Array.from(row.children);
  const [label, line] = Array.from(text?.children ?? []);
  return { button: row, tile, text, label, line, chevron };
}

describe('PlaybackSection — the Codecs row is the Sync row', () => {
  it('matches the Sync metadata & posters row rule for rule', async () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <ThemeProvider theme={theme}>
          <SnackbarProvider>
            <NetworkSection />
            <PlaybackSection />
          </SnackbarProvider>
        </ThemeProvider>
      </MemoryRouter>
    );
    await lineLanded();
    const syncRow = await screen.findByRole('button', {
      name: /Sync metadata & posters/,
    });

    const sync = partsOf(syncRow);
    const codecs = partsOf(codecsRow());

    for (const part of ['button', 'tile', 'text', 'label', 'line', 'chevron']) {
      expect(sync[part], `the Sync row's ${part}`).toBeDefined();
      expect(codecs[part], `the Codecs row's ${part}`).toBeDefined();
      expect(codecs[part].tagName, part).toBe(sync[part].tagName);
      const syncStyle = resolved(sync[part]);
      expect(Object.keys(syncStyle).length, part).toBeGreaterThan(0);
      expect(resolved(codecs[part]), part).toEqual(syncStyle);
    }
  });
});
