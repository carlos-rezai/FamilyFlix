import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { LibraryFolders } from './LibraryFolders';
import type { LibraryFolder } from '@/types';
import { theme } from '@/styles/theme';
import {
  LocationProbe,
  navigationType,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import {
  conflictResponse,
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';

/**
 * 30 — Library folders, Phase 2: "the Folder scan" (issue #269).
 *
 * The page's group **Scan**: _What the scanner accepts_ (`FolderShapes`),
 * then **Scan folders** — `primary`, `lg` — disabled while no folder is
 * listed. A press posts `POST /api/library-folders/scan { enrich: false }`
 * and pushes `/import`; a `409` pushes too, so the run already in flight is
 * the one shown.
 *
 * Phase 4 (issue #271) draws `EnrichCheckCard` between the shapes and the
 * button, with Import setup's stored-key hint, and _Scan folders_ sends the
 * box's value as `enrich`.
 *
 * The wire is a stubbed `fetch`: the list on GET, the scan's answer on its
 * POST.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const MOVIES: LibraryFolder = {
  id: 'f-movies',
  path: 'E:\\Movies',
  titleCount: 12,
  reachable: true,
};

const method = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const path = (input: RequestInfo | URL) =>
  new URL(String(input), 'http://localhost').pathname;

const isScan = (input: RequestInfo | URL, init?: RequestInit) =>
  path(input) === '/api/library-folders/scan' && method(init) === 'POST';

/**
 * The list on GET; the scan answered `201` with a run, or `409`; and the
 * stored TMDB key — one by default — on `/api/tmdb/key`, which chooses the
 * box's hint.
 */
function serve(
  listed: LibraryFolder[],
  scan: 'created' | 'busy' = 'created',
  key: string | null = 'stored-key'
) {
  fetchMock.mockImplementation((input, init) => {
    if (path(input) === '/api/tmdb/key') {
      return Promise.resolve(okResponse({ key }));
    }
    if (isScan(input, init)) {
      return Promise.resolve(
        scan === 'created'
          ? createdResponse(makeImportRun({ source: 'folders' }))
          : conflictResponse('An import is already running.')
      );
    }
    return Promise.resolve(okResponse(listed));
  });
}

function renderPage(
  history: string[] = ['/', '/settings', '/settings/folders']
) {
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/" element={<p>the browse home</p>} />
          <Route path="/settings" element={<p>the settings hub</p>} />
          <Route path="/settings/folders" element={<LibraryFolders />} />
          <Route path="/import" element={<p>the import screen</p>} />
        </Routes>
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
}

const scanButton = () => screen.findByRole('button', { name: 'Scan folders' });

const scanCalls = () =>
  fetchMock.mock.calls.filter(([input, init]) => isScan(input, init));

describe('LibraryFolders — the group Scan', () => {
  it('draws Scan, What the scanner accepts, then Scan folders', async () => {
    serve([MOVIES]);
    renderPage();

    const button = await scanButton();
    expect(screen.getByText('Scan')).toBeDefined();
    expect(screen.getByText('What the scanner accepts')).toBeDefined();
    expect(
      screen
        .getByText('What the scanner accepts')
        .compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('disables Scan folders while no folder is listed', async () => {
    serve([]);
    renderPage();

    const button = (await scanButton()) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(scanCalls()).toHaveLength(0);
  });

  it('enables Scan folders once a folder is listed', async () => {
    serve([MOVIES]);
    renderPage();

    const button = (await scanButton()) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});

describe('LibraryFolders — Scan folders', () => {
  it('posts the scan with enrich false and pushes /import on 201', async () => {
    serve([MOVIES]);
    renderPage();

    await userEvent.click(await scanButton());

    await waitFor(() => expect(pathname()).toBe('/import'));
    expect(navigationType()).toBe('PUSH');
    expect(scanCalls()).toHaveLength(1);
    const [, init] = scanCalls()[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({ enrich: false });
    expect(screen.getByText('the import screen')).toBeDefined();
  });

  it('pushes /import on 409 too, to show the run already in flight', async () => {
    serve([MOVIES], 'busy');
    renderPage();

    await userEvent.click(await scanButton());

    await waitFor(() => expect(pathname()).toBe('/import'));
    expect(scanCalls()).toHaveLength(1);
  });
});

const ENRICH_LABEL = 'Also fetch metadata and posters from TMDB';
const HINT_WITH_KEY =
  'Runs straight after the scan, over everything it brings in. Needs the internet.';
const HINT_WITHOUT_KEY =
  'Needs a TMDB key. Add one under Settings → Network first.';

const enrichBox = () =>
  screen.findByRole('checkbox', { name: new RegExp(ENRICH_LABEL) });

describe('LibraryFolders — Also fetch from TMDB', () => {
  it('draws the box unticked, between What the scanner accepts and Scan folders', async () => {
    serve([MOVIES]);
    renderPage();

    const box = (await enrichBox()) as HTMLInputElement;
    const button = await scanButton();
    expect(box.checked).toBe(false);
    expect(
      screen
        .getByText('What the scanner accepts')
        .compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      box.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('reads the with-key hint when a key is stored', async () => {
    serve([MOVIES], 'created', 'stored-key');
    renderPage();

    expect(await screen.findByText(HINT_WITH_KEY)).toBeDefined();
    expect(screen.queryByText(HINT_WITHOUT_KEY)).toBeNull();
  });

  it('reads the without-key hint when none is', async () => {
    serve([MOVIES], 'created', null);
    renderPage();

    expect(await screen.findByText(HINT_WITHOUT_KEY)).toBeDefined();
    expect(screen.queryByText(HINT_WITH_KEY)).toBeNull();
  });

  it('sends enrich true once the box is ticked', async () => {
    serve([MOVIES]);
    renderPage();

    await userEvent.click(await enrichBox());
    await userEvent.click(await scanButton());

    await waitFor(() => expect(pathname()).toBe('/import'));
    const [, init] = scanCalls()[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({ enrich: true });
  });

  it('sends enrich false again once the box is unticked', async () => {
    serve([MOVIES]);
    renderPage();

    await userEvent.click(await enrichBox());
    await userEvent.click(await enrichBox());
    await userEvent.click(await scanButton());

    await waitFor(() => expect(pathname()).toBe('/import'));
    const [, init] = scanCalls()[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({ enrich: false });
  });
});

/**
 * 41 — Link or copy, Slice 3: "a linked film plays" (issue #343).
 *
 * The group **Scan** draws the **Import mode** (`ImportModeChoice`) above
 * **Scan folders**: the _Files_ caption over two radios, **Link** chosen on
 * every mount and never remembered, and the press posts the chosen `mode`
 * beside `enrich`.
 */
const modeGroup = () => screen.findByRole('radiogroup', { name: 'Files' });
const modeRadio = (name: 'Link' | 'Copy') =>
  screen.findByRole('radio', { name: new RegExp(`^${name}`) });

describe('LibraryFolders — the Import mode', () => {
  it('draws the choice between What the scanner accepts and Scan folders', async () => {
    serve([MOVIES]);
    renderPage();

    const group = await modeGroup();
    const button = await scanButton();
    expect(
      screen
        .getByText('What the scanner accepts')
        .compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      group.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('chooses Link on mount', async () => {
    serve([MOVIES]);
    renderPage();

    expect((await modeRadio('Link')).getAttribute('aria-checked')).toBe('true');
    expect((await modeRadio('Copy')).getAttribute('aria-checked')).toBe(
      'false'
    );
  });

  it('posts mode link when nothing is pressed', async () => {
    serve([MOVIES]);
    renderPage();

    await userEvent.click(await scanButton());

    await waitFor(() => expect(pathname()).toBe('/import'));
    const [, init] = scanCalls()[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      enrich: false,
      mode: 'link',
      all: false,
    });
  });

  it('posts mode copy once Copy is pressed', async () => {
    serve([MOVIES]);
    renderPage();

    await userEvent.click(await modeRadio('Copy'));
    await userEvent.click(await scanButton());

    await waitFor(() => expect(pathname()).toBe('/import'));
    const [, init] = scanCalls()[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      enrich: false,
      mode: 'copy',
      all: false,
    });
  });

  it('chooses Link again on the next mount — the choice is never remembered', async () => {
    serve([MOVIES]);
    const first = renderPage();
    await userEvent.click(await modeRadio('Copy'));
    expect((await modeRadio('Copy')).getAttribute('aria-checked')).toBe('true');
    first.unmount();

    renderPage();

    expect((await modeRadio('Link')).getAttribute('aria-checked')).toBe('true');
  });
});

/**
 * Release review (issue #424): **Scan every folder again**.
 *
 * A `CheckCard` in the group **Scan**, under the **Import mode** (_Files_) and
 * above the TMDB box: _Scan every folder again_ over its hint, off on every
 * visit and never remembered. _Scan folders_ posts it as `all` beside
 * `enrich` and `mode`: off, the scan reads only the folders with no **Scanned
 * mark**; ticked, every reachable one.
 */
const RESCAN_LABEL = 'Scan every folder again';
const RESCAN_HINT =
  'Reads the folders already scanned too, for files added or changed since. Nothing already in the library is imported twice.';

const rescanBox = () =>
  screen.findByRole('checkbox', { name: new RegExp(RESCAN_LABEL) });

describe('LibraryFolders — Scan every folder again', () => {
  it('draws the box unticked with its hint', async () => {
    serve([MOVIES]);
    renderPage();

    expect(((await rescanBox()) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(RESCAN_HINT)).toBeDefined();
  });

  it('draws it under the Import mode and above the TMDB box', async () => {
    serve([MOVIES]);
    renderPage();

    const rescan = await rescanBox();
    const group = await modeGroup();
    const enrich = await enrichBox();
    expect(
      group.compareDocumentPosition(rescan) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      rescan.compareDocumentPosition(enrich) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('posts all false when nothing is pressed', async () => {
    serve([MOVIES]);
    renderPage();

    await userEvent.click(await scanButton());

    await waitFor(() => expect(pathname()).toBe('/import'));
    const [, init] = scanCalls()[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({ all: false });
  });

  it('posts all true once the box is ticked', async () => {
    serve([MOVIES]);
    renderPage();

    await userEvent.click(await rescanBox());
    expect(((await rescanBox()) as HTMLInputElement).checked).toBe(true);
    await userEvent.click(await scanButton());

    await waitFor(() => expect(pathname()).toBe('/import'));
    const [, init] = scanCalls()[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      enrich: false,
      mode: 'link',
      all: true,
    });
  });

  it('is off again on the next visit, never remembered', async () => {
    serve([MOVIES]);
    const first = renderPage();
    await userEvent.click(await rescanBox());
    expect(((await rescanBox()) as HTMLInputElement).checked).toBe(true);
    first.unmount();

    renderPage();

    expect(((await rescanBox()) as HTMLInputElement).checked).toBe(false);
  });
});
