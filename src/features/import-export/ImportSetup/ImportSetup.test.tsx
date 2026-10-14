import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ImportSetup, type ImportSetupProps } from './ImportSetup';
import type { LibraryFolder } from '@/types';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';

/**
 * 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125), and
 * 40 — Import review, Phase 1: "the sheet over the folders" (issue #331).
 *
 * The **Setup step**, from `feat.ImportFlow.dc.html`: the spreadsheet's path
 * typed into one mono field, then the group **Library folders** in place of
 * the old root field, and _Start import_. The run reads every listed folder,
 * so the group draws the list as `GET /api/library-folders` answers it — each
 * row its path in mono and its title count, or _Can’t be reached right now_
 * in `danger` — edited in place on the `FolderListEditor`, the Library
 * folders page's own list: each row's ✕, the typed add, and _Browse…_ in the
 * desktop app, several folders at once. Nothing of the group is drawn until
 * the list lands.
 *
 * The sheet field is controlled — its value, its refusal and its handler are
 * handed in, with the `folders` refusal the route words for a stale screen —
 * so what is under test is the surface. The wire is a stubbed `fetch`.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

const DANGER = 'rgb(201, 122, 106)';

const MOVIES: LibraryFolder = {
  id: 'f-movies',
  path: 'E:\\Movies',
  titleCount: 12,
  reachable: true,
};

const ARCHIVE: LibraryFolder = {
  id: 'f-archive',
  path: 'F:\\Archive',
  titleCount: 4,
  reachable: false,
};

const isFolders = (input: RequestInfo | URL, init?: RequestInit) =>
  String(input).endsWith('/api/library-folders') &&
  (init?.method ?? 'GET').toUpperCase() === 'GET';

/** The list route answers `folders`; anything else is a request setup never makes. */
function answerFolders(folders: LibraryFolder[]): void {
  fetchMock.mockImplementation(async (input, init) => {
    if (isFolders(input, init)) {
      return okResponse(folders);
    }
    throw new Error(`Unexpected request: ${String(input)}`);
  });
}

/**
 * A `fetch` over a list the way the routes keep it: GET answers it, a POST
 * adds the path with no titles, a DELETE drops the id.
 */
function libraryWire(initial: LibraryFolder[]): void {
  let listed = [...initial];
  let next = 0;
  fetchMock.mockImplementation(async (input, init) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'POST') {
      const { path } = JSON.parse(String(init?.body)) as { path: string };
      next += 1;
      const folder = { id: `f-${next}`, path, titleCount: 0, reachable: true };
      listed = [...listed, folder];
      return createdResponse(folder);
    }
    if (method === 'DELETE') {
      const id = String(input).split('/').pop();
      listed = listed.filter((folder) => folder.id !== id);
      return { ok: true, status: 204 } as Response;
    }
    return okResponse(listed);
  });
}

/** The list route held until the test lets it answer. */
function holdFolders(folders: LibraryFolder[]): () => void {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  fetchMock.mockImplementation(async (input, init) => {
    if (isFolders(input, init)) {
      await held;
      return okResponse(folders);
    }
    throw new Error(`Unexpected request: ${String(input)}`);
  });
  return release;
}

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>();
  vi.stubGlobal('fetch', fetchMock);
  answerFolders([MOVIES]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderSetup(props: Partial<ImportSetupProps> = {}) {
  return render(
    <MemoryRouter initialEntries={['/settings', '/import']} initialIndex={1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route
            path="/import"
            element={
              <ImportSetup
                sheet=""
                sheetError={null}
                foldersError={null}
                onSheet={() => undefined}
                onStart={() => undefined}
                mode="link"
                onMode={() => undefined}
                enrich={false}
                keySet={false}
                onToggleEnrich={() => undefined}
                {...props}
              />
            }
          />
          <Route
            path="/settings/folders"
            element={<p>the library folders page</p>}
          />
        </Routes>
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
}

const sheetField = () =>
  screen.getByRole('textbox', { name: 'Spreadsheet' }) as HTMLInputElement;
const startButton = () =>
  screen.getByRole('button', { name: 'Start import' }) as HTMLButtonElement;
/** The group's label, once the list has landed. */
const groupLabel = () => screen.findByText('Library folders');

/** The box a field is drawn as — the input's own wrapper. */
const boxOf = (input: HTMLInputElement) => input.parentElement as HTMLElement;

/** The row a listed path is drawn in: the path's own parent. */
const rowOf = (path: string) =>
  screen.getByText(path).parentElement as HTMLElement;

const SHEET = 'C:\\Movies\\library.xlsx';

describe('ImportSetup — the spreadsheet field', () => {
  it('draws the field with its placeholder, above the Library folders group', async () => {
    renderSetup();

    expect(sheetField().placeholder).toBe('C:\\Movies\\library.xlsx');
    expect(comesBefore(sheetField(), await groupLabel())).toBe(true);
  });

  it('shows the value it is handed, and reports new text to its handler', () => {
    const onSheet = vi.fn();
    renderSetup({ sheet: SHEET, onSheet });

    expect(sheetField().value).toBe(SHEET);
    fireEvent.change(sheetField(), { target: { value: 'D:\\lib.csv' } });
    expect(onSheet).toHaveBeenCalledWith('D:\\lib.csv');
  });

  it('draws the field mono, 50 high and square-cornered, led by its glyph', () => {
    renderSetup();

    expect(getComputedStyle(sheetField()).fontFamily).toContain(
      'JetBrains Mono'
    );
    expect(getComputedStyle(boxOf(sheetField())).height).toBe('50px');
    expect(getComputedStyle(boxOf(sheetField())).borderRadius).toBe(
      theme.radius.md
    );
    expect(boxOf(sheetField()).querySelector('svg')).not.toBeNull();
  });

  it('draws no root field', async () => {
    renderSetup();
    await groupLabel();

    expect(screen.queryByText('Movies root folder')).toBeNull();
    expect(screen.getAllByRole('textbox')).toEqual([
      sheetField(),
      screen.getByRole('textbox', { name: 'Folder path' }),
    ]);
  });
});

describe('ImportSetup — the Library folders group, listed', () => {
  it('reads the list once', async () => {
    renderSetup();
    await groupLabel();

    expect(
      fetchMock.mock.calls.filter(([input, init]) => isFolders(input, init))
    ).toHaveLength(1);
  });

  it('draws each listed folder’s path in mono with its title count, in the order listed', async () => {
    answerFolders([MOVIES, { ...ARCHIVE, reachable: true }]);
    renderSetup();
    await groupLabel();

    const movies = screen.getByText('E:\\Movies');
    const archive = screen.getByText('F:\\Archive');
    expect(getComputedStyle(movies).fontFamily).toContain('JetBrains Mono');
    expect(comesBefore(movies, archive)).toBe(true);
    expect(within(rowOf('E:\\Movies')).getByText('12 titles')).toBeDefined();
    expect(within(rowOf('F:\\Archive')).getByText('4 titles')).toBeDefined();
  });

  it('draws an unreachable folder’s line as Can’t be reached right now, in danger', async () => {
    answerFolders([MOVIES, ARCHIVE]);
    renderSetup();
    await groupLabel();

    const line = within(rowOf('F:\\Archive')).getByText(
      'Can’t be reached right now'
    );
    expect(getComputedStyle(line).color).toBe(DANGER);
    expect(within(rowOf('F:\\Archive')).queryByText('4 titles')).toBeNull();
  });

  it('draws a ✕ on each row, and no Manage folders', async () => {
    answerFolders([MOVIES, ARCHIVE]);
    renderSetup();
    await groupLabel();

    expect(
      screen.getByRole('button', { name: 'Remove E:\\Movies' })
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Remove F:\\Archive' })
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Manage folders' })).toBeNull();
  });
});

describe('ImportSetup — the Library folders group, edited in place', () => {
  it('takes a folder off with its ✕', async () => {
    libraryWire([MOVIES, ARCHIVE]);
    renderSetup();
    await groupLabel();

    fireEvent.click(screen.getByRole('button', { name: 'Remove F:\\Archive' }));

    await waitFor(() => expect(screen.queryByText('F:\\Archive')).toBeNull());
    expect(screen.getByText('E:\\Movies')).toBeDefined();
  });

  it('adds a typed folder to the list', async () => {
    libraryWire([MOVIES]);
    renderSetup();
    await groupLabel();

    fireEvent.change(screen.getByRole('textbox', { name: 'Folder path' }), {
      target: { value: 'G:\\Series' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('G:\\Series')).toBeDefined();
  });

  it('draws No folders yet. with none listed, and enables Start import once one is added', async () => {
    libraryWire([]);
    renderSetup({ sheet: SHEET });

    expect(await screen.findByText('No folders yet.')).toBeDefined();
    expect(startButton().disabled).toBe(true);

    fireEvent.change(screen.getByRole('textbox', { name: 'Folder path' }), {
      target: { value: 'E:\\Movies' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(startButton().disabled).toBe(false));
  });

  it('draws no Browse… in a browser', async () => {
    renderSetup();
    await groupLabel();

    expect(screen.queryByRole('button', { name: 'Browse…' })).toBeNull();
  });
});

describe('ImportSetup — Browse… in the desktop app', () => {
  const bridge = fakeFolderBridge();

  /** The two Browse… buttons, in document order: the sheet's, the folders'. */
  const browseButtons = () =>
    screen.getAllByRole('button', { name: 'Browse…' });

  it('draws a Browse… beside the spreadsheet field, before the folders’ own', async () => {
    renderSetup();
    await groupLabel();

    const [sheetBrowse, foldersBrowse] = browseButtons();
    expect(comesBefore(sheetField(), sheetBrowse)).toBe(true);
    expect(comesBefore(sheetBrowse, await groupLabel())).toBe(true);
    expect(comesBefore(await groupLabel(), foldersBrowse)).toBe(true);
  });

  it('hands the spreadsheet picked to the field’s handler', async () => {
    const onSheet = vi.fn();
    bridge.setPickSheet('D:\\Lists\\library.xlsx');
    renderSetup({ onSheet });
    await groupLabel();

    fireEvent.click(browseButtons()[0]);

    await waitFor(() =>
      expect(onSheet).toHaveBeenCalledWith('D:\\Lists\\library.xlsx')
    );
    expect(bridge.pickSheets()).toBe(1);
  });

  it('leaves the field as it was for a cancelled pick', async () => {
    const onSheet = vi.fn();
    renderSetup({ sheet: SHEET, onSheet });
    await groupLabel();

    fireEvent.click(browseButtons()[0]);

    await waitFor(() => expect(bridge.pickSheets()).toBe(1));
    expect(onSheet).not.toHaveBeenCalled();
  });

  it('adds every folder picked, in the order picked', async () => {
    libraryWire([MOVIES]);
    bridge.setPick(['G:\\Series', 'H:\\Films']);
    renderSetup();
    await groupLabel();

    fireEvent.click(browseButtons()[1]);

    const films = await screen.findByText('H:\\Films');
    expect(comesBefore(screen.getByText('G:\\Series'), films)).toBe(true);
    expect(comesBefore(screen.getByText('E:\\Movies'), films)).toBe(true);
  });
});

describe('ImportSetup — the Library folders group, loading', () => {
  it('draws nothing of the group until the list lands', async () => {
    const release = holdFolders([MOVIES]);
    renderSetup();

    expect(screen.queryByText('Library folders')).toBeNull();
    expect(screen.queryByText('E:\\Movies')).toBeNull();
    expect(screen.queryByText('No folders yet.')).toBeNull();

    release();
    expect(await groupLabel()).toBeDefined();
  });
});

describe('ImportSetup — Start import', () => {
  it('is disabled while the spreadsheet is empty', async () => {
    renderSetup();
    await groupLabel();

    expect(startButton().disabled).toBe(true);
  });

  it('is enabled once the spreadsheet is filled and a folder is listed', async () => {
    renderSetup({ sheet: SHEET });

    await waitFor(() => expect(startButton().disabled).toBe(false));
  });

  it('is disabled with no folder listed, whatever the spreadsheet says', async () => {
    answerFolders([]);
    renderSetup({ sheet: SHEET });
    await screen.findByText('No folders yet.');

    expect(startButton().disabled).toBe(true);
  });

  it('is disabled while the list has not landed', () => {
    holdFolders([MOVIES]);
    renderSetup({ sheet: SHEET });

    expect(startButton().disabled).toBe(true);
  });

  it('starts the import when pressed', async () => {
    const onStart = vi.fn();
    renderSetup({ sheet: SHEET, onStart });
    await waitFor(() => expect(startButton().disabled).toBe(false));

    fireEvent.click(startButton());

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('starts nothing while disabled', async () => {
    const onStart = vi.fn();
    renderSetup({ onStart });
    await groupLabel();

    fireEvent.click(startButton());

    expect(onStart).not.toHaveBeenCalled();
  });
});

/**
 * The one invented line in the initiative (design log `13-bulk-import` Q7): a
 * 13px line in the danger colour under what the refusal names — the sheet's
 * under its field, and the route's `folders` refusal (a stale screen's start)
 * under the Library folders group.
 */
describe('ImportSetup — the refusal line', () => {
  it('draws nothing when nothing is refused', async () => {
    renderSetup({ sheet: SHEET });
    await groupLabel();

    expect(screen.queryByText(/could not/i)).toBeNull();
    expect(screen.queryByText('Add a library folder first.')).toBeNull();
  });

  it('draws the sheet’s reason under the spreadsheet field, above the group', async () => {
    renderSetup({
      sheet: SHEET,
      sheetError: 'That spreadsheet could not be found.',
    });

    const line = screen.getByText('That spreadsheet could not be found.');
    expect(comesBefore(sheetField(), line)).toBe(true);
    expect(comesBefore(line, await groupLabel())).toBe(true);
  });

  it('draws the folders’ reason under the group, above Start import', async () => {
    renderSetup({ sheet: SHEET, foldersError: 'Add a library folder first.' });

    const line = await screen.findByText('Add a library folder first.');
    expect(comesBefore(screen.getByText('E:\\Movies'), line)).toBe(true);
    expect(comesBefore(line, startButton())).toBe(true);
  });

  it('draws both lines at 13px in the danger colour', async () => {
    renderSetup({
      sheet: SHEET,
      sheetError: 'That spreadsheet could not be found.',
      foldersError: 'Add a library folder first.',
    });

    for (const line of [
      screen.getByText('That spreadsheet could not be found.'),
      await screen.findByText('Add a library folder first.'),
    ]) {
      expect(getComputedStyle(line).fontSize).toBe('13px');
      expect(getComputedStyle(line).color).toBe(DANGER);
    }
  });

  it('keeps the sheet’s value on screen under a refusal', () => {
    renderSetup({
      sheet: SHEET,
      sheetError: 'That spreadsheet could not be found.',
    });

    expect(sheetField().value).toBe(SHEET);
  });
});

/**
 * 22 — Series (TV), Phase 8: "re-runs, year ranges, unnamed shows, the setup
 * panel" (issue #198).
 *
 * _What the scanner accepts_, word for word from `feat.ImportFlow.dc.html`:
 * the three shapes in mono with the prototype's backslashes — the loose
 * shape's note in the sans face — and the folder-first rule, its two tags in
 * mono. It sits under the Library folders group, above _Start import_.
 */
describe('ImportSetup — what the scanner accepts', () => {
  const normalized = (text: string | null) =>
    (text ?? '').replace(/\s+/g, ' ').trim();

  /** The deepest element whose text holds `text` — whatever it is nested in. */
  function innermost(text: string): HTMLElement {
    const holding = Array.from(document.body.querySelectorAll('*')).filter(
      (element) => normalized(element.textContent).includes(text)
    );
    const deepest = holding.filter(
      (element) =>
        !holding.some((other) => other !== element && element.contains(other))
    );
    if (deepest.length !== 1) {
      throw new Error(
        `expected one element holding "${text}", found ${deepest.length}`
      );
    }
    return deepest[0] as HTMLElement;
  }

  const SHAPES = [
    'Movie Title (2019)\\ movie.mkv · subs.en.srt',
    'Show Name\\ Season 01\\ S01E03.mkv',
    'Show Name\\ S01E03.mkv',
  ];
  const LOOSE_NOTE = '(loose episodes at the show root are fine)';
  const RULE =
    'Season and episode numbers come from the folder first, then the filename (S01E03, 1x03). Anything it can’t place lands in the review list.';

  it('draws its heading under the Library folders group, above Start import', async () => {
    renderSetup();

    const heading = screen.getByText('What the scanner accepts');
    expect(comesBefore(await groupLabel(), heading)).toBe(true);
    expect(comesBefore(heading, startButton())).toBe(true);
  });

  it('lists the three shapes, in order, with the prototype’s backslashes', () => {
    renderSetup();

    const text = normalized(document.body.textContent);
    const at = SHAPES.map((shape) => text.indexOf(shape));
    expect(at.every((index) => index >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(text).toContain(`${SHAPES[2]} ${LOOSE_NOTE}`);
  });

  it('sets the shapes in mono and the loose shape’s note in the sans face', () => {
    renderSetup();

    for (const shape of SHAPES) {
      expect(getComputedStyle(innermost(shape)).fontFamily).toContain(
        'JetBrains Mono'
      );
    }
    expect(getComputedStyle(innermost(LOOSE_NOTE)).fontFamily).toContain(
      'Hanken Grotesk'
    );
  });

  it('states the folder-first rule word for word, after the shapes', () => {
    renderSetup();

    const text = normalized(document.body.textContent);
    expect(text).toContain(RULE);
    expect(text.indexOf(SHAPES[2])).toBeLessThan(text.indexOf(RULE));
  });

  it('sets the rule’s two tags in mono', () => {
    renderSetup();

    for (const tag of ['S01E03', '1x03']) {
      expect(getComputedStyle(screen.getByText(tag)).fontFamily).toContain(
        'JetBrains Mono'
      );
    }
  });
});
