import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { LibraryFolders } from './LibraryFolders';
import { Button, type ButtonProps } from '@/primitives';
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
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';
import { makeLibraryFolder } from '@/test-support/makeLibraryFolder/makeLibraryFolder';

/**
 * 30 — Library folders, Phase 2: "the Folder scan" (issue #269).
 *
 * The page's group **Scan**: _What the scanner accepts_ (`FolderShapes`),
 * then **Scan all folders** — `primary`, `lg` — disabled while no folder
 * is listed. A press posts `POST /api/library-folders/scan { enrich: false }`
 * and pushes `/import`; a `409` pushes too, so the run already in flight is
 * the one shown.
 *
 * Phase 4 (issue #271) draws `EnrichCheckCard` between the shapes and the
 * button, with Import setup's stored-key hint, and _Scan all folders_ sends
 * the box's value as `enrich`.
 *
 * The wire is a stubbed `fetch`: the list on GET, the scan's answer on its
 * POST.
 *
 * 54: Scan new folders (issue #495): _Scan folders_ is now **Scan all
 * folders**, so the suites above press it; its own describe is at the foot.
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

const MOVIES: LibraryFolder = makeLibraryFolder({
  id: 'f-movies',
  path: 'E:\\Movies',
  titleCount: 12,
});

/** A **New folder**: listed, never read by a run. */
const CARTOONS: LibraryFolder = makeLibraryFolder({
  id: 'f-cartoons',
  path: 'E:\\Cartoons',
  scannedAt: null,
});

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
  scan: 'created' | 'busy' | 'pending' = 'created',
  key: string | null = 'stored-key'
) {
  fetchMock.mockImplementation((input, init) => {
    if (path(input) === '/api/tmdb/key') {
      return Promise.resolve(okResponse({ key }));
    }
    if (isScan(input, init)) {
      if (scan === 'pending') {
        return new Promise<Response>(() => undefined);
      }
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

const scanButton = () =>
  screen.findByRole('button', { name: 'Scan all folders' });

const scanCalls = () =>
  fetchMock.mock.calls.filter(([input, init]) => isScan(input, init));

describe('LibraryFolders — the group Scan', () => {
  it('draws Scan, What the scanner accepts, then Scan all folders', async () => {
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

  it('disables Scan all folders while no folder is listed', async () => {
    serve([]);
    renderPage();

    const button = (await scanButton()) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(scanCalls()).toHaveLength(0);
  });

  it('enables Scan all folders once a folder is listed', async () => {
    serve([MOVIES]);
    renderPage();

    const button = (await scanButton()) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});

describe('LibraryFolders — Scan all folders', () => {
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
  it('draws the box unticked, between What the scanner accepts and Scan all folders', async () => {
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
 * **Scan all folders**: the _Files_ caption over two radios, **Link** chosen
 * on every mount and never remembered, and the press posts the chosen `mode`
 * beside `enrich`.
 */
const modeGroup = () =>
  screen.findByRole('radiogroup', { name: 'Link or copy' });
const modeRadio = (name: 'Link' | 'Copy') =>
  screen.findByRole('radio', { name: new RegExp(`^${name}`) });

describe('LibraryFolders — the Import mode', () => {
  it('draws the choice between What the scanner accepts and Scan all folders', async () => {
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
      scope: 'all',
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
      scope: 'all',
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
 * 54: Scan new folders (issue #495).
 *
 * The group Scan ends in two `lg` presses side by side: **Scan new folders**
 * (`primary`), disabled with no **New folder** listed, then **Scan all
 * folders** (`secondary`), disabled with no folder listed. Each posts its
 * **Scan scope** beside the Import mode and the box and pushes `/import`;
 * both are held while either scan is asked. _Scan folders_ is gone.
 */
const scanNewButton = () =>
  screen.findByRole('button', { name: 'Scan new folders' });

/** What a `Button` of `variant` at `lg` draws, read off a reference one. */
function faceOf(variant: NonNullable<ButtonProps['variant']>) {
  const { getByRole, unmount } = render(
    <ThemeProvider theme={theme}>
      <Button label="Reference" variant={variant} size="lg" />
    </ThemeProvider>
  );
  const face = drawnFace(getByRole('button', { name: 'Reference' }));
  unmount();
  return face;
}

function drawnFace(button: Element) {
  const drawn = resolvedStyle(button);
  return Object.fromEntries(
    ['background', 'border', 'height', 'padding', 'font-size'].map(
      (property) => [property, normCss(drawn[property] ?? '')]
    )
  );
}

describe('LibraryFolders: Scan new folders and Scan all folders', () => {
  it('draws Scan new folders then Scan all folders, after the box', async () => {
    serve([MOVIES, CARTOONS]);
    renderPage();

    const scanNew = await scanNewButton();
    const scanAll = await scanButton();
    const box = await enrichBox();
    expect(
      box.compareDocumentPosition(scanNew) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      scanNew.compareDocumentPosition(scanAll) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(scanNew.parentElement).toBe(scanAll.parentElement);
  });

  it('draws Scan new folders as a primary lg and Scan all folders as a secondary lg', async () => {
    serve([MOVIES, CARTOONS]);
    renderPage();

    const scanNew = drawnFace(await scanNewButton());
    const scanAll = drawnFace(await scanButton());
    expect(scanNew).toEqual(faceOf('primary'));
    expect(scanAll).toEqual(faceOf('secondary'));
  });

  it('draws no Scan folders', async () => {
    serve([MOVIES, CARTOONS]);
    renderPage();

    await scanButton();
    expect(screen.queryByRole('button', { name: 'Scan folders' })).toBeNull();
    expect(screen.queryByText('Scan folders')).toBeNull();
  });

  it('disables both while no folder is listed', async () => {
    serve([]);
    renderPage();

    expect(((await scanNewButton()) as HTMLButtonElement).disabled).toBe(true);
    expect(((await scanButton()) as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables only Scan new folders while every folder is scanned', async () => {
    serve([MOVIES]);
    renderPage();

    expect(((await scanNewButton()) as HTMLButtonElement).disabled).toBe(true);
    expect(((await scanButton()) as HTMLButtonElement).disabled).toBe(false);
  });

  it('enables both once a New folder is listed', async () => {
    serve([MOVIES, CARTOONS]);
    renderPage();

    expect(((await scanNewButton()) as HTMLButtonElement).disabled).toBe(false);
    expect(((await scanButton()) as HTMLButtonElement).disabled).toBe(false);
  });

  it.each([
    ['Scan new folders', 'new'],
    ['Scan all folders', 'all'],
  ])(
    '%s posts scope %s with the mode and the box, and pushes /import',
    async (name, scope) => {
      serve([MOVIES, CARTOONS]);
      renderPage();

      await userEvent.click(await enrichBox());
      await userEvent.click(await modeRadio('Copy'));
      await userEvent.click(await screen.findByRole('button', { name }));

      await waitFor(() => expect(pathname()).toBe('/import'));
      expect(navigationType()).toBe('PUSH');
      expect(scanCalls()).toHaveLength(1);
      const [, init] = scanCalls()[0] ?? [];
      expect(JSON.parse(String(init?.body))).toEqual({
        enrich: true,
        mode: 'copy',
        scope,
      });
    }
  );

  it.each(['Scan new folders', 'Scan all folders'])(
    'holds both while %s is asked',
    async (name) => {
      serve([MOVIES, CARTOONS], 'pending');
      renderPage();

      await userEvent.click(await screen.findByRole('button', { name }));

      await waitFor(() =>
        expect(
          (
            screen.getByRole('button', {
              name: 'Scan new folders',
            }) as HTMLButtonElement
          ).disabled
        ).toBe(true)
      );
      expect(((await scanButton()) as HTMLButtonElement).disabled).toBe(true);
      expect(scanCalls()).toHaveLength(1);
      expect(pathname()).toBe('/settings/folders');
    }
  );
});
