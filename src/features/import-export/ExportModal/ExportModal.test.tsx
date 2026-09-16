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
import { stubDownload } from '@/test-support/stubDownload/stubDownload';
import {
  fileResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 14 — Export, Phase 1: "the tracer bullet" (issue #137).
 *
 * The **Export dialog**, 1:1 from `feat.ExportModal.dc.html`: the Modal with
 * the download glyph, _Export library_ and its line; _Format_ over the two
 * **Format cards** with CSV checked on every open; the filename row with the
 * **Export summary**'s count; _Columns included_ over the eight **Export
 * columns** as pills — a list, not controls; _Export as CSV_ / _Export as
 * Excel_ beside _Cancel_. Then **Export ready**, swapped inside the same card
 * as the one **Bare modal**: the tick, the heading, the filename and the count
 * in the copy, and _Done_.
 *
 * The Modal's own contract — the portal, Escape, the scrim, focus — is tested
 * with the Modal; what is left here is what makes this dialog *this* dialog:
 * what it shows, what a choice changes, and what pressing export does. The
 * dialog owns `useExport`, so it is read through its buttons and its copy, in
 * the Delete dialog's style, with `fetch` stubbed and the browser's download
 * read through `stubDownload`.
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

const isSummary = (input: RequestInfo | URL) =>
  String(input).endsWith('/api/export');

const csv = () =>
  new Blob(['\uFEFFTitle,Year\nDie Hard,1988\n'], {
    type: 'text/csv; charset=utf-8',
  });

/** A file route that answers only when the test says so. */
function held() {
  let settle: (response: Response) => void = () => undefined;
  let refuse: (reason: Error) => void = () => undefined;
  const pending = new Promise<Response>((resolve, reject) => {
    settle = resolve;
    refuse = reject;
  });
  return {
    file: () => pending,
    settle: (response: Response) => settle(response),
    refuse: (reason: Error) => refuse(reason),
  };
}

/**
 * A server with a library of `movieCount` movies. The summary answers the
 * count, or never (`pending`); the file route answers `file`.
 */
function serve({
  movieCount = 3,
  summary = 'ok',
  file = () => fileResponse(csv()),
}: {
  movieCount?: number;
  summary?: 'ok' | 'pending' | 'failing';
  file?: () => Promise<Response> | Response;
} = {}) {
  fetchMock.mockImplementation((input) => {
    if (isSummary(input)) {
      if (summary === 'pending') {
        return new Promise<Response>(() => undefined);
      }
      return Promise.resolve(
        summary === 'ok' ? okResponse({ movieCount }) : serverErrorResponse()
      );
    }
    return Promise.resolve(file());
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
const csvCard = () => within(dialog()).getByRole('radio', { name: /CSV/ });
const excelCard = () => within(dialog()).getByRole('radio', { name: /Excel/ });
const exportButton = (format: 'CSV' | 'Excel' = 'CSV') =>
  within(dialog()).getByRole('button', { name: `Export as ${format}` });
const exportingButton = () =>
  within(dialog()).getByRole('button', { name: 'Exporting…' });
const cancelButton = () =>
  within(dialog()).getByRole('button', { name: 'Cancel' });
const doneButton = () => within(dialog()).getByRole('button', { name: 'Done' });
const countLabel = () => within(dialog()).queryByText(/^\d+ movies?$/);

/** The card's text with every space removed — the done copy has a `<br />` in it. */
const squashed = () => (dialog().textContent ?? '').replace(/\s+/g, '');

const COLUMNS = [
  'Title',
  'Year',
  'Genres',
  'Director',
  'Cast',
  'Rating',
  'Status',
  'Subtitles',
];

describe('ExportModal — closed', () => {
  it('renders nothing', () => {
    serve();

    renderDialog({ open: false });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Export library')).toBeNull();
  });

  it('asks the server nothing', async () => {
    serve();

    renderDialog({ open: false });

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});

describe('ExportModal — the idle face', () => {
  it('is the dialog named Export library, with its line', () => {
    serve();

    renderDialog();

    const card = idleDialog();
    expect(
      within(card).getByRole('heading', { name: 'Export library' })
    ).toBeDefined();
    expect(
      within(card).getByText('Save your whole collection as a spreadsheet.')
    ).toBeDefined();
  });

  it('draws the download glyph in the header tile', () => {
    serve();

    renderDialog();

    // The prototype's path, at the tile's 22px.
    const glyph = idleDialog().querySelector(
      'path[d="M12 3v11m0 0l-4-4m4 4l4-4M5 19h14"]'
    );
    expect(glyph).not.toBeNull();
    expect(glyph?.closest('svg')?.getAttribute('width')).toBe('22');
  });

  it('offers the two Format cards in a group named Format, CSV checked', () => {
    serve();

    renderDialog();

    const group = within(dialog()).getByRole('radiogroup', { name: 'Format' });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0]).toBe(csvCard());
    expect(radios[1]).toBe(excelCard());
    expect(csvCard().getAttribute('aria-checked')).toBe('true');
    expect(excelCard().getAttribute('aria-checked')).toBe('false');
  });

  it('draws each card with its line', () => {
    serve();

    renderDialog();

    expect(
      within(dialog()).getByText('Plain comma-separated. Opens anywhere.')
    ).toBeDefined();
    expect(
      within(dialog()).getByText('.xlsx workbook with a header row.')
    ).toBeDefined();
  });

  it('names the file family-library.csv', () => {
    serve();

    renderDialog();

    expect(within(dialog()).getByText('family-library.csv')).toBeDefined();
  });

  it('shows the count once the summary lands', async () => {
    serve({ movieCount: 3 });

    renderDialog();

    expect(await within(dialog()).findByText('3 movies')).toBeDefined();
  });

  it('shows 1 movie in the singular', async () => {
    serve({ movieCount: 1 });

    renderDialog();

    expect(await within(dialog()).findByText('1 movie')).toBeDefined();
  });

  it('shows 0 movies for an empty library', async () => {
    serve({ movieCount: 0 });

    renderDialog();

    expect(await within(dialog()).findByText('0 movies')).toBeDefined();
  });

  it('shows no count while the summary has not landed', () => {
    serve({ summary: 'pending' });

    renderDialog();

    expect(countLabel()).toBeNull();
    expect(within(dialog()).queryByText(/null|undefined|NaN/)).toBeNull();
  });

  it('shows no count when the summary fails, and nothing else changes', async () => {
    serve({ summary: 'failing' });

    renderDialog();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(countLabel()).toBeNull();
    expect(exportButton('CSV')).toBeDefined();
    expect(within(dialog()).queryByText(/error|failed|try again/i)).toBeNull();
  });

  it('lists the eight columns as pills under Columns included', () => {
    serve();

    renderDialog();

    expect(within(dialog()).getByText('Columns included')).toBeDefined();
    const list = within(dialog()).getByRole('list');
    const pills = within(list).getAllByRole('listitem');
    expect(pills.map((pill) => pill.textContent)).toEqual(COLUMNS);
  });

  it('draws the pills as a list, not as controls', () => {
    serve();

    renderDialog();

    const list = within(dialog()).getByRole('list');
    expect(within(list).queryAllByRole('button')).toHaveLength(0);
    expect(within(list).queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('offers Export as CSV and Cancel, in that order', () => {
    serve();

    renderDialog();

    const buttons = within(dialog())
      .getAllByRole('button')
      .map((button) => button.textContent);
    const exportAt = buttons.indexOf('Export as CSV');
    const cancelAt = buttons.indexOf('Cancel');
    expect(exportAt).toBeGreaterThanOrEqual(0);
    expect(cancelAt).toBeGreaterThan(exportAt);
  });

  it('offers the ✕', () => {
    serve();

    renderDialog();

    expect(
      within(dialog()).getByRole('button', { name: 'Close' })
    ).toBeDefined();
  });
});

describe('ExportModal — choosing Excel', () => {
  it('checks the Excel card and unchecks CSV', () => {
    serve();
    renderDialog();

    fireEvent.click(excelCard());

    expect(excelCard().getAttribute('aria-checked')).toBe('true');
    expect(csvCard().getAttribute('aria-checked')).toBe('false');
  });

  it('switches the filename to family-library.xlsx', () => {
    serve();
    renderDialog();

    fireEvent.click(excelCard());

    expect(within(dialog()).getByText('family-library.xlsx')).toBeDefined();
    expect(within(dialog()).queryByText('family-library.csv')).toBeNull();
  });

  it('switches the button to Export as Excel', () => {
    serve();
    renderDialog();

    fireEvent.click(excelCard());

    expect(exportButton('Excel')).toBeDefined();
    expect(
      within(dialog()).queryByRole('button', { name: 'Export as CSV' })
    ).toBeNull();
  });

  it('switches back on CSV', () => {
    serve();
    renderDialog();
    fireEvent.click(excelCard());

    fireEvent.click(csvCard());

    expect(csvCard().getAttribute('aria-checked')).toBe('true');
    expect(within(dialog()).getByText('family-library.csv')).toBeDefined();
    expect(exportButton('CSV')).toBeDefined();
  });

  it('keeps the count through the switch', async () => {
    serve({ movieCount: 3 });
    renderDialog();
    await within(dialog()).findByText('3 movies');

    fireEvent.click(excelCard());

    expect(within(dialog()).getByText('3 movies')).toBeDefined();
  });
});

describe('ExportModal — exporting', () => {
  const browser = stubDownload();

  it('reads Exporting… and is disabled for the life of the request', async () => {
    const request = held();
    serve({ file: request.file });
    renderDialog();

    fireEvent.click(exportButton('CSV'));

    await waitFor(() => expect(exportingButton()).toBeDefined());
    expect((exportingButton() as HTMLButtonElement).disabled).toBe(true);
    expect(
      within(dialog()).queryByRole('button', { name: 'Export as CSV' })
    ).toBeNull();
  });

  it('leaves the cards and Cancel alone while the request runs', async () => {
    const request = held();
    serve({ file: request.file });
    renderDialog();

    fireEvent.click(exportButton('CSV'));
    await waitFor(() => expect(exportingButton()).toBeDefined());

    expect((cancelButton() as HTMLButtonElement).disabled).toBe(false);
    expect((csvCard() as HTMLButtonElement).disabled).toBe(false);
    expect((excelCard() as HTMLButtonElement).disabled).toBe(false);
  });

  it('hands the file to the browser as family-library.csv', async () => {
    const blob = csv();
    serve({ file: () => fileResponse(blob) });
    renderDialog();

    fireEvent.click(exportButton('CSV'));

    await waitFor(() => expect(browser.downloads()).toHaveLength(1));
    expect(browser.downloads()[0]).toMatchObject({
      blob,
      filename: 'family-library.csv',
    });
  });

  it('then shows the done face: the tick, Export ready, the filename and the count', async () => {
    serve({ movieCount: 3 });
    renderDialog();
    await within(dialog()).findByText('3 movies');

    fireEvent.click(exportButton('CSV'));

    await waitFor(() =>
      expect(
        within(dialog()).getByRole('heading', { name: 'Export ready' })
      ).toBeDefined()
    );
    // The prototype's tick path, in the watched-tinted circle.
    expect(
      dialog().querySelector('path[d="M5 12.5l4.5 4.5L19 7.5"]')
    ).not.toBeNull();
    expect(squashed()).toContain(
      'Savedfamily-library.csvwith3moviestoyourcomputer.'
    );
    expect(doneButton()).toBeDefined();
  });

  it('says 1 movie in the singular on the done face too', async () => {
    serve({ movieCount: 1 });
    renderDialog();
    await within(dialog()).findByText('1 movie');

    fireEvent.click(exportButton('CSV'));

    await waitFor(() => expect(doneButton()).toBeDefined());
    expect(squashed()).toContain('with1movieto');
  });

  it('draws the done face bare — no header, no ✕, named Export ready', async () => {
    serve();
    renderDialog();

    fireEvent.click(exportButton('CSV'));

    await waitFor(() => expect(doneButton()).toBeDefined());
    const card = screen.getByRole('dialog', { name: 'Export ready' });
    expect(
      within(card).queryByRole('heading', { name: 'Export library' })
    ).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Close' })).toBeNull();
    expect(within(card).queryByRole('radio')).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('is done only once the browser has the file', async () => {
    const request = held();
    serve({ file: request.file });
    renderDialog();

    fireEvent.click(exportButton('CSV'));
    await waitFor(() => expect(exportingButton()).toBeDefined());
    expect(within(dialog()).queryByRole('button', { name: 'Done' })).toBeNull();

    request.settle(fileResponse(csv()));

    await waitFor(() => expect(doneButton()).toBeDefined());
    expect(browser.downloads()).toHaveLength(1);
  });

  it('closes from Done', async () => {
    const onClose = vi.fn();
    serve();
    renderDialog({ onClose });

    fireEvent.click(exportButton('CSV'));
    await waitFor(() => expect(doneButton()).toBeDefined());
    fireEvent.click(doneButton());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes the done face from Escape and the scrim', async () => {
    const onClose = vi.fn();
    serve();
    renderDialog({ onClose });
    fireEvent.click(exportButton('CSV'));
    await waitFor(() => expect(doneButton()).toBeDefined());

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    fireEvent.click(dialog().parentElement as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('exports as Excel under the Excel filename when the route answers', async () => {
    serve();
    renderDialog();
    fireEvent.click(excelCard());

    fireEvent.click(exportButton('Excel'));

    await waitFor(() => expect(doneButton()).toBeDefined());
    expect(browser.downloads()[0].filename).toBe('family-library.xlsx');
    expect(squashed()).toContain('Savedfamily-library.xlsx');
  });
});

describe('ExportModal — a request the server refuses', () => {
  const browser = stubDownload();

  it('puts the button back and leaves the idle face as it was', async () => {
    const request = held();
    serve({ movieCount: 3, file: request.file });
    renderDialog();
    await within(dialog()).findByText('3 movies');

    fireEvent.click(exportButton('CSV'));
    await waitFor(() => expect(exportingButton()).toBeDefined());
    request.settle(serverErrorResponse());

    // The Delete dialog's rule: the prototype designs no error face, so a
    // refusal puts the button back and changes nothing else — the dialog still
    // up for a second try.
    await waitFor(() => expect(exportButton('CSV')).toBeDefined());
    expect((exportButton('CSV') as HTMLButtonElement).disabled).toBe(false);
    expect(idleDialog()).toBeDefined();
    expect(within(dialog()).getByText('3 movies')).toBeDefined();
    expect(
      within(dialog()).queryByRole('heading', { name: 'Export ready' })
    ).toBeNull();
    expect(within(dialog()).queryByText(/error|failed|try again/i)).toBeNull();
    expect(browser.downloads()).toHaveLength(0);
  });

  it('keeps the format when Export as Excel is refused', async () => {
    serve({ file: () => serverErrorResponse() });
    renderDialog();
    fireEvent.click(excelCard());

    fireEvent.click(exportButton('Excel'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(exportButton('Excel')).toBeDefined());
    expect(excelCard().getAttribute('aria-checked')).toBe('true');
    expect(within(dialog()).getByText('family-library.xlsx')).toBeDefined();
    expect(within(dialog()).queryByRole('button', { name: 'Done' })).toBeNull();
    expect(browser.downloads()).toHaveLength(0);
  });

  it('puts the button back when there is no server', async () => {
    const request = held();
    serve({ file: request.file });
    renderDialog();

    fireEvent.click(exportButton('CSV'));
    await waitFor(() => expect(exportingButton()).toBeDefined());
    request.refuse(new Error('offline'));

    await waitFor(() => expect(exportButton('CSV')).toBeDefined());
    expect(idleDialog()).toBeDefined();
  });

  it('exports on a second press', async () => {
    let attempts = 0;
    serve({
      file: () => {
        attempts += 1;
        return attempts === 1 ? serverErrorResponse() : fileResponse(csv());
      },
    });
    renderDialog();

    fireEvent.click(exportButton('CSV'));
    await waitFor(() => expect(exportButton('CSV')).toBeDefined());
    fireEvent.click(exportButton('CSV'));

    await waitFor(() => expect(doneButton()).toBeDefined());
    expect(browser.downloads()).toHaveLength(1);
  });
});

describe('ExportModal — the ways out of the idle face', () => {
  it('closes from Cancel, exporting nothing', () => {
    const onClose = vi.fn();
    serve();
    renderDialog({ onClose });

    fireEvent.click(cancelButton());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls.filter(([input]) => !isSummary(input))
    ).toHaveLength(0);
  });

  it('closes from the ✕', () => {
    const onClose = vi.fn();
    serve();
    renderDialog({ onClose });

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from Escape and the scrim', () => {
    const onClose = vi.fn();
    serve();
    renderDialog({ onClose });

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    fireEvent.click(dialog().parentElement as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('ExportModal — reopening', () => {
  stubDownload();

  it('opens on CSV and the idle face again, with a fresh count', async () => {
    serve({ movieCount: 3 });
    const { rerender } = renderDialog();
    await within(dialog()).findByText('3 movies');
    fireEvent.click(excelCard());
    fireEvent.click(exportButton('Excel'));
    await waitFor(() => expect(doneButton()).toBeDefined());

    rerender(
      <ThemeProvider theme={theme}>
        <ExportModal open={false} onClose={() => undefined} />
      </ThemeProvider>
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    serve({ movieCount: 4 });
    rerender(
      <ThemeProvider theme={theme}>
        <ExportModal open onClose={() => undefined} />
      </ThemeProvider>
    );

    expect(idleDialog()).toBeDefined();
    expect(csvCard().getAttribute('aria-checked')).toBe('true');
    expect(within(dialog()).getByText('family-library.csv')).toBeDefined();
    expect(exportButton('CSV')).toBeDefined();
    expect(await within(dialog()).findByText('4 movies')).toBeDefined();
  });
});
