import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { DeleteSeriesDialog } from './DeleteSeriesDialog';
import type { LinkedFiles } from '@/types';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import { noContentResponse } from '@/test-support/fakeResponse/fakeResponse';

/**
 * 51 — Library audit, Phase 9: "the Recycle choice in the Delete dialog"
 * (issue #452, log 51 Q6), on the series page.
 *
 * The series page's Delete dialog draws `DeleteTitleDialog`'s body
 * (`page.SeriesPage`): **What goes / What stays**, and for a linked show in
 * the shell whose files aren't `shared`, the **Recycle choice**: **Keep the
 * files** (_Its folder, in your library folder_ kept), chosen on every open,
 * or **Move them to the Recycle Bin** (_Its folder, to the Recycle Bin_ and
 * the callout), the only card that sends `?files=trash`. _Delete series_
 * never changes. A `shared` show draws no cards and keeps _Its video
 * file(s), which another title plays_; a copied show and a browser draw no
 * cards. The show's Linked files are handed in as `linkedFiles`.
 */

const SHARED_GOES = [
  'Its details, poster and artwork',
  'Its watch history, rating and heart',
];
const CALLOUT =
  'This is a linked title. Its files go from your library folder to the Recycle Bin, not just out of FamilyFlix.';
const KEEP = /^Keep the files/;
const TRASH = /^Move them to the Recycle Bin/;

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>(() => Promise.resolve(noContentResponse()));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function ui({
  open = true,
  linkedFiles = 'folder',
}: { open?: boolean; linkedFiles?: LinkedFiles | null } = {}) {
  return (
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/', '/series/s1']} initialIndex={1}>
        <DeleteSeriesDialog
          seriesId="s1"
          title="Bluey"
          episodeCount={24}
          linkedFiles={linkedFiles}
          open={open}
          onClose={() => undefined}
        />
      </MemoryRouter>
    </ThemeProvider>
  );
}

const dialog = () => screen.getByRole('dialog');
const card = (label: RegExp) =>
  within(dialog()).getByRole('radio', { name: label });
const confirm = () =>
  within(dialog()).getByRole('button', { name: /^Delete series$|^Deleting/ });

/** The list under a heading: the first `ul` that follows it. */
function itemsOf(heading: string): (string | null)[] {
  const label = within(dialog()).getByText(heading);
  const list = within(dialog())
    .getAllByRole('list')
    .find((candidate) => comesBefore(label, candidate));
  if (!list) {
    throw new Error(`no list under ${heading}`);
  }
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent);
}

describe('DeleteSeriesDialog — the Recycle choice, in the shell', () => {
  fakeFolderBridge();

  it('draws the two cards for a linked show, Keep the files chosen', () => {
    render(ui());

    const group = within(dialog()).getByRole('radiogroup', {
      name: 'Its files',
    });
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    expect(card(KEEP).getAttribute('aria-checked')).toBe('true');
    expect(card(TRASH).getAttribute('aria-checked')).toBe('false');
  });

  it('keeps its folder under What stays, with no callout', () => {
    render(ui());

    expect(itemsOf('What goes')).toEqual(SHARED_GOES);
    expect(itemsOf('What stays')).toEqual([
      'Its folder, in your library folder',
    ]);
    expect(within(dialog()).queryByText(CALLOUT)).toBeNull();
  });

  it('moves its folder to What goes with the callout on the Recycle Bin card, Delete series unchanged', () => {
    render(ui());

    fireEvent.click(card(TRASH));

    expect(itemsOf('What goes')).toEqual([
      ...SHARED_GOES,
      'Its folder, to the Recycle Bin',
    ]);
    expect(itemsOf('What stays')).toEqual(['Nothing']);
    expect(within(dialog()).getByText(CALLOUT)).toBeDefined();
    expect(confirm().textContent).toBe('Delete series');
  });

  it('sends the plain delete on Keep the files', async () => {
    render(ui());
    expect(card(KEEP).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(confirm());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [input, init] = fetchMock.mock.calls[0]!;
    expect(String(input)).toBe('/api/series/s1');
    expect(init?.method?.toUpperCase()).toBe('DELETE');
  });

  it('sends files=trash on the Recycle Bin card', async () => {
    render(ui());

    fireEvent.click(card(TRASH));
    fireEvent.click(confirm());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [input, init] = fetchMock.mock.calls[0]!;
    expect(String(input)).toBe('/api/series/s1?files=trash');
    expect(init?.method?.toUpperCase()).toBe('DELETE');
  });

  it('chooses Keep the files on the next open, after a Recycle Bin pick', () => {
    const { rerender } = render(ui());
    fireEvent.click(card(TRASH));

    rerender(ui({ open: false }));
    rerender(ui({ open: true }));

    expect(card(KEEP).getAttribute('aria-checked')).toBe('true');
    expect(card(TRASH).getAttribute('aria-checked')).toBe('false');
  });

  it('draws no cards for a shared show, and reads that another title plays it', () => {
    render(ui({ linkedFiles: 'shared' }));

    expect(within(dialog()).queryAllByRole('radio')).toEqual([]);
    expect(itemsOf('What stays')).toEqual([
      'Its video file(s), which another title plays',
    ]);
    expect(within(dialog()).queryByText(CALLOUT)).toBeNull();
  });

  it('draws no cards for a copied show, its lists still drawn', () => {
    render(ui({ linkedFiles: null }));

    expect(within(dialog()).queryAllByRole('radio')).toEqual([]);
    expect(itemsOf('What goes')).toEqual(expect.arrayContaining(SHARED_GOES));
  });
});

describe('DeleteSeriesDialog — the Recycle choice, in a browser', () => {
  it('draws no cards for a linked show, and keeps its files', async () => {
    render(ui());

    expect(within(dialog()).queryAllByRole('radio')).toEqual([]);
    expect(itemsOf('What stays')).toEqual([
      'Its folder, in your library folder',
    ]);

    fireEvent.click(confirm());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0]![0])).toBe('/api/series/s1');
  });
});
