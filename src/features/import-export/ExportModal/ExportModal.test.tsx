import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { ExportModal } from './ExportModal';
import { theme } from '@/styles/theme';
import type { ExportResult, ExportSummary } from '@/types';
import {
  createdResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 31 — Export options, Phase 1: "the tracer" (issue #276).
 *
 * The **Export dialog**, against the revised `feat.ExportModal.dc.html`: the
 * server writes the export into a folder now, so the idle face reads, top to
 * bottom —
 *
 * 1. the header: the download tile, _Export library_, and the new lede,
 *    _Save your whole collection — details, artwork and all._;
 * 2. **Format**, the two Format cards, unchanged;
 * 3. **Save to**: a mono `TextField` with the folder glyph, and under it the
 *    13px `danger` refusal line when the route refused the path;
 * 4. the name row: the folder glyph, the **Export name** in mono, and
 *    `N titles` / `1 title` in accent — dropped while the summary is `null`;
 * 5. **Columns included**: the sixteen pills;
 * 6. _Export as CSV / Excel_, _Exporting…_ and disabled in flight, and
 *    _Cancel_.
 *
 * **Export ready** keeps its Bare modal and gains the new copy: _Saved
 * `<folder name>` to `<destination>` with N titles._, naming the folder
 * actually written, the count clause dropped when the summary never landed.
 *
 * The Modal's own contract is tested with the Modal. The dialog owns
 * `useExport`, so it is read through its controls and its copy with `fetch`
 * stubbed.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const FOLDER_GLYPH =
  'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z';

const NAME = 'familyflix-collection_08-10-2026';

const summaryOf = (overrides: Partial<ExportSummary> = {}): ExportSummary => ({
  movieCount: 3,
  seriesCount: 1,
  episodeCount: 8,
  defaultDestination: 'E:\\Movies',
  folderName: NAME,
  ...overrides,
});

/** The folder a 201 says it wrote — numbered, to prove the copy reads it. */
const WRITTEN: ExportResult = {
  folder: `E:\\Movies\\${NAME} (1)`,
  movieCount: 3,
  seriesCount: 1,
};

const COLUMNS = [
  'Type',
  'Title',
  'Year',
  'Runtime',
  'Genres',
  'Director',
  'Cast',
  'Synopsis',
  'Rating',
  'Status',
  'Favorite',
  'Seasons',
  'Episodes',
  'Subtitles',
  'Poster',
  'Backdrop',
];

const isPost = (init?: RequestInit) => init?.method === 'POST';

/** A 400 carrying the route's one sentence. */
function badRequest(error: string): Response {
  return {
    ok: false,
    status: 400,
    json: () => Promise.resolve({ error }),
  } as unknown as Response;
}

function held() {
  let settle: (response: Response) => void = () => undefined;
  const pending = new Promise<Response>((resolve) => {
    settle = resolve;
  });
  return {
    answer: () => pending,
    settle: (response: Response) => settle(response),
  };
}

function serve({
  summary = 'ok',
  summaryBody = summaryOf(),
  post = () => Promise.resolve(createdResponse(WRITTEN)),
}: {
  summary?: 'ok' | 'pending' | 'failing';
  summaryBody?: ExportSummary;
  post?: () => Promise<Response>;
} = {}) {
  fetchMock.mockImplementation((_, init) => {
    if (isPost(init)) {
      return post();
    }
    if (summary === 'pending') {
      return new Promise<Response>(() => undefined);
    }
    return Promise.resolve(
      summary === 'ok' ? okResponse(summaryBody) : serverErrorResponse()
    );
  });
}

function renderDialog({
  open = true,
  onClose = () => undefined,
}: { open?: boolean; onClose?: () => void } = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <ExportModal open={open} onClose={onClose} />
    </ThemeProvider>
  );
}

const dialog = () => screen.getByRole('dialog');
const idleDialog = () => screen.getByRole('dialog', { name: 'Export library' });
const excelCard = () => within(dialog()).getByRole('radio', { name: /Excel/ });
const csvCard = () => within(dialog()).getByRole('radio', { name: /CSV/ });
const saveTo = () =>
  within(dialog()).getByRole('textbox', {
    name: 'Save to',
  }) as HTMLInputElement;
const exportButton = (format: 'CSV' | 'Excel' = 'CSV') =>
  within(dialog()).getByRole('button', { name: `Export as ${format}` });
const exportingButton = () =>
  within(dialog()).getByRole('button', { name: 'Exporting…' });
const countLabel = () => within(dialog()).queryByText(/^\d+ titles?$/);
const squashed = () => (dialog().textContent ?? '').replace(/\s+/g, '');

/** Whether `a` comes before `b` in the document. */
const before = (a: Node, b: Node) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('ExportModal — the idle face, top to bottom', () => {
  it('is named Export library, with the new lede', () => {
    serve();

    renderDialog();

    const card = idleDialog();
    expect(
      within(card).getByRole('heading', { name: 'Export library' })
    ).toBeDefined();
    expect(
      within(card).getByText(
        'Save your whole collection — details, artwork and all.'
      )
    ).toBeDefined();
  });

  it('offers the two Format cards unchanged, CSV checked', () => {
    serve();

    renderDialog();

    const group = within(dialog()).getByRole('radiogroup', { name: 'Format' });
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    expect(csvCard().getAttribute('aria-checked')).toBe('true');
    expect(
      within(dialog()).getByText('Plain comma-separated. Opens anywhere.')
    ).toBeDefined();
  });

  it('draws Save to as a field under its label, after Format', () => {
    serve();

    renderDialog();

    expect(within(dialog()).getByText('Save to')).toBeDefined();
    expect(
      before(
        within(dialog()).getByRole('radiogroup', { name: 'Format' }),
        saveTo()
      )
    ).toBe(true);
  });

  it('fills Save to with the default destination once the summary lands', async () => {
    serve();

    renderDialog();

    await waitFor(() => expect(saveTo().value).toBe('E:\\Movies'));
  });

  it('draws the folder glyph in the field and on the name row', () => {
    serve();

    renderDialog();

    const glyphs = dialog().querySelectorAll(`path[d="${FOLDER_GLYPH}"]`);
    expect(glyphs.length).toBeGreaterThanOrEqual(2);
  });

  it('names the export folder on the name row, after Save to', async () => {
    serve();

    renderDialog();

    const name = await within(dialog()).findByText(NAME);
    expect(before(saveTo(), name)).toBe(true);
  });

  it('counts the films and the series together as titles', async () => {
    serve({ summaryBody: summaryOf({ movieCount: 3, seriesCount: 1 }) });

    renderDialog();

    expect(await within(dialog()).findByText('4 titles')).toBeDefined();
  });

  it('reads 1 title in the singular', async () => {
    serve({ summaryBody: summaryOf({ movieCount: 1, seriesCount: 0 }) });

    renderDialog();

    expect(await within(dialog()).findByText('1 title')).toBeDefined();
  });

  it('draws no count while the summary has not landed', () => {
    serve({ summary: 'pending' });

    renderDialog();

    expect(countLabel()).toBeNull();
    expect(within(dialog()).queryByText(/null|undefined|NaN/)).toBeNull();
  });

  it('draws no count when the summary fails', async () => {
    serve({ summary: 'failing' });

    renderDialog();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(countLabel()).toBeNull();
    expect(exportButton('CSV')).toBeDefined();
  });

  it('lists the sixteen columns as pills under Columns included', () => {
    serve();

    renderDialog();

    expect(within(dialog()).getByText('Columns included')).toBeDefined();
    const list = within(dialog()).getByRole('list');
    const pills = within(list).getAllByRole('listitem');
    expect(pills.map((pill) => pill.textContent)).toEqual(COLUMNS);
    expect(within(list).queryAllByRole('button')).toHaveLength(0);
  });

  it('offers Export as CSV then Cancel, after the pills', () => {
    serve();

    renderDialog();

    const cancel = within(dialog()).getByRole('button', { name: 'Cancel' });
    expect(before(within(dialog()).getByRole('list'), exportButton())).toBe(
      true
    );
    expect(before(exportButton(), cancel)).toBe(true);
  });

  it('reads Export as Excel once Excel is chosen', () => {
    serve();
    renderDialog();

    fireEvent.click(excelCard());

    expect(exportButton('Excel')).toBeDefined();
  });

  it('draws no refusal line before anything was refused', () => {
    serve();

    renderDialog();

    expect(within(dialog()).queryByText('No folder at that path.')).toBeNull();
  });
});

describe('ExportModal — exporting', () => {
  it('posts what Save to holds', async () => {
    serve();
    renderDialog();
    await waitFor(() => expect(saveTo().value).toBe('E:\\Movies'));
    fireEvent.change(saveTo(), { target: { value: 'D:\\Backups' } });

    fireEvent.click(exportButton());

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => isPost(init))).toBe(true)
    );
    const [, init] =
      fetchMock.mock.calls.find(([, call]) => isPost(call)) ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      format: 'csv',
      destination: 'D:\\Backups',
      images: true,
      subtitles: false,
    });
  });

  it('reads Exporting… and is disabled in flight', async () => {
    const request = held();
    serve({ post: request.answer });
    renderDialog();

    fireEvent.click(exportButton());

    expect(exportingButton()).toBeDefined();
    expect((exportingButton() as HTMLButtonElement).disabled).toBe(true);

    request.settle(createdResponse(WRITTEN));
    await within(screen.getByRole('dialog')).findByText('Export ready');
  });
});

describe('ExportModal — a refused destination', () => {
  it('shows the route’s sentence under Save to, on the idle face', async () => {
    serve({
      post: () => Promise.resolve(badRequest('No folder at that path.')),
    });
    renderDialog();

    fireEvent.click(exportButton());

    const line = await within(dialog()).findByText('No folder at that path.');
    expect(before(saveTo(), line)).toBe(true);
    expect(idleDialog()).toBeDefined();
  });

  it('keeps the path that was typed', async () => {
    serve({
      post: () => Promise.resolve(badRequest('No folder at that path.')),
    });
    renderDialog();
    await waitFor(() => expect(saveTo().value).toBe('E:\\Movies'));
    fireEvent.change(saveTo(), { target: { value: 'Q:\\Nowhere' } });

    fireEvent.click(exportButton());

    await within(dialog()).findByText('No folder at that path.');
    expect(saveTo().value).toBe('Q:\\Nowhere');
    expect(exportButton()).toBeDefined();
  });

  it('leaves the idle face as it was on any other failure', async () => {
    serve({ post: () => Promise.resolve(serverErrorResponse()) });
    renderDialog();

    fireEvent.click(exportButton());

    await waitFor(() => expect(exportButton()).toBeDefined());
    expect(idleDialog()).toBeDefined();
    expect(within(dialog()).queryByText('Export ready')).toBeNull();
  });
});

describe('ExportModal — Export ready', () => {
  it('names the folder written and the destination, with the count', async () => {
    serve();
    renderDialog();
    await within(dialog()).findByText('4 titles');

    fireEvent.click(exportButton());

    const done = await screen.findByRole('dialog', { name: 'Export ready' });
    expect(within(done).getByText(`${NAME} (1)`)).toBeDefined();
    expect(within(done).getByText('E:\\Movies')).toBeDefined();
    expect(squashed()).toContain(`Saved${NAME}(1)toE:\\Movieswith4titles.`);
  });

  it('says 1 title in the singular', async () => {
    serve({ summaryBody: summaryOf({ movieCount: 1, seriesCount: 0 }) });
    renderDialog();
    await within(dialog()).findByText('1 title');

    fireEvent.click(exportButton());

    await screen.findByRole('dialog', { name: 'Export ready' });
    expect(squashed()).toContain('with1title.');
  });

  it('drops the count clause when the summary never landed', async () => {
    serve({ summary: 'failing' });
    renderDialog();
    fireEvent.change(saveTo(), { target: { value: 'E:\\Movies' } });

    fireEvent.click(exportButton());

    await screen.findByRole('dialog', { name: 'Export ready' });
    expect(squashed()).toContain(`Saved${NAME}(1)toE:\\Movies.`);
    expect(squashed()).not.toMatch(/with\d+titles?/);
  });

  it('closes from Done', async () => {
    const onClose = vi.fn();
    serve();
    renderDialog({ onClose });

    fireEvent.click(exportButton());
    await screen.findByRole('dialog', { name: 'Export ready' });

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

/**
 * 31 — Export options, Phase 3: images (issue #278).
 *
 * The **Include** group, after the name row and before _Columns included_:
 * a Settings-`Row`-furniture row reading _Images_ over _Posters, backdrops
 * and episode stills, in a folder per title._, with a Toggle — on by default,
 * and what the request sends.
 */
describe('ExportModal — Include', () => {
  const imagesToggle = () =>
    within(dialog()).getByRole('switch', { name: 'Images' });

  it('draws the Include group between the name row and the columns', async () => {
    serve();

    renderDialog();

    const include = within(dialog()).getByText('Include');
    const name = await within(dialog()).findByText(NAME);
    expect(before(name, include)).toBe(true);
    expect(
      before(include, within(dialog()).getByText('Columns included'))
    ).toBe(true);
  });

  it('draws the Images row with its line and its Toggle, on', () => {
    serve();

    renderDialog();

    expect(within(dialog()).getByText('Images')).toBeDefined();
    expect(
      within(dialog()).getByText(
        'Posters, backdrops and episode stills, in a folder per title.'
      )
    ).toBeDefined();
    expect(imagesToggle().getAttribute('aria-checked')).toBe('true');
  });

  it('turns the Toggle off on a press', () => {
    serve();
    renderDialog();

    fireEvent.click(imagesToggle());

    expect(imagesToggle().getAttribute('aria-checked')).toBe('false');
  });

  it('sends images off once the Toggle is off', async () => {
    serve();
    renderDialog();
    await waitFor(() => expect(saveTo().value).toBe('E:\\Movies'));
    fireEvent.click(imagesToggle());

    fireEvent.click(exportButton());

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => isPost(init))).toBe(true)
    );
    const [, init] =
      fetchMock.mock.calls.find(([, call]) => isPost(call)) ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({ images: false });
  });
});

/**
 * 31 — Export options, Phase 4: subtitles (issue #279).
 *
 * The Include group's second row, after _Images_: _Subtitles_ over _Every
 * subtitle file, beside its title's images._, with a Toggle — off by default,
 * and what the request sends.
 */
describe('ExportModal — Include, Subtitles', () => {
  const subtitlesToggle = () =>
    within(dialog()).getByRole('switch', { name: 'Subtitles' });
  const imagesToggle = () =>
    within(dialog()).getByRole('switch', { name: 'Images' });

  it('draws the Subtitles row second, after Images and before the columns', () => {
    serve();

    renderDialog();

    expect(before(imagesToggle(), subtitlesToggle())).toBe(true);
    expect(
      before(subtitlesToggle(), within(dialog()).getByText('Columns included'))
    ).toBe(true);
  });

  it('draws the Subtitles row with its line and its Toggle, off', () => {
    serve();

    renderDialog();

    expect(
      within(dialog()).getByText(
        "Every subtitle file, beside its title's images."
      )
    ).toBeDefined();
    expect(subtitlesToggle().getAttribute('aria-checked')).toBe('false');
  });

  it('turns the Toggle on on a press', () => {
    serve();
    renderDialog();

    fireEvent.click(subtitlesToggle());

    expect(subtitlesToggle().getAttribute('aria-checked')).toBe('true');
  });

  it('sends subtitles on once the Toggle is on', async () => {
    serve();
    renderDialog();
    await waitFor(() => expect(saveTo().value).toBe('E:\\Movies'));
    fireEvent.click(subtitlesToggle());

    fireEvent.click(exportButton());

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => isPost(init))).toBe(true)
    );
    const [, init] =
      fetchMock.mock.calls.find(([, call]) => isPost(call)) ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({ subtitles: true });
  });
});
