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

import { DeleteMovieDialog } from './DeleteMovieDialog';
import type { LinkedFiles } from '@/types';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';
import { noContentResponse } from '@/test-support/fakeResponse/fakeResponse';

/**
 * 51 — Library audit, Phase 9: "the Recycle choice in the Delete dialog"
 * (issue #452, log 51 Q6), on the movie page.
 *
 * The movie page's Delete dialog draws `DeleteTitleDialog`'s body
 * (`page.MoviePage`): **What goes / What stays** by the film's **Linked
 * files**, and for a linked film in the shell whose files aren't `shared`,
 * the **Recycle choice**: **Keep the files**, chosen on every open, or **Move
 * them to the Recycle Bin**, the only card that sends `?files=trash`. The
 * lists and the callout follow the choice; _Delete movie_ never changes. A
 * `shared` film draws no cards and keeps _Its video file(s), which another
 * title plays_; a copied film and a browser draw no cards. The film's Linked
 * files are handed in as `deleteFacts`, the detail read's **Delete facts**.
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

/** Where the film lies, as the detail read's `deleteFacts.path` spells it. */
const NORTHWIND_PATH = 'D:/Films/Northwind (2004)';

function ui({
  open = true,
  linkedFiles = 'videos',
  originalPath = null,
}: {
  open?: boolean;
  linkedFiles?: LinkedFiles | null;
  originalPath?: string | null;
} = {}) {
  return (
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/', '/movie/m1']} initialIndex={1}>
        <DeleteMovieDialog
          movieId="m1"
          title="Northwind"
          deleteFacts={{ path: NORTHWIND_PATH, linkedFiles, originalPath }}
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
  within(dialog()).getByRole('button', { name: /^Delete movie$|^Deleting/ });

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

describe('DeleteMovieDialog — the Recycle choice, in the shell', () => {
  fakeFolderBridge();

  it('draws the two cards for a linked film, Keep the files chosen', () => {
    render(ui());

    const group = within(dialog()).getByRole('radiogroup', {
      name: 'Its files',
    });
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    expect(card(KEEP).getAttribute('aria-checked')).toBe('true');
    expect(card(TRASH).getAttribute('aria-checked')).toBe('false');
  });

  it('keeps the video file(s) under What stays, with no callout', () => {
    render(ui());

    expect(itemsOf('What goes')).toEqual(SHARED_GOES);
    expect(itemsOf('What stays')).toEqual([
      'Its video file(s), in your library folder',
    ]);
    expect(within(dialog()).queryByText(CALLOUT)).toBeNull();
  });

  it('moves them to What goes with the callout on the Recycle Bin card, Delete movie unchanged', () => {
    render(ui());

    fireEvent.click(card(TRASH));

    expect(itemsOf('What goes')).toEqual([
      ...SHARED_GOES,
      'Its video file(s), to the Recycle Bin',
    ]);
    expect(itemsOf('What stays')).toEqual(['Nothing']);
    expect(within(dialog()).getByText(CALLOUT)).toBeDefined();
    expect(confirm().textContent).toBe('Delete movie');
  });

  it('sends the plain delete on Keep the files', async () => {
    render(ui());
    expect(card(KEEP).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(confirm());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toBe('/api/movies/m1');
    expect(init?.method?.toUpperCase()).toBe('DELETE');
  });

  it('sends files=trash on the Recycle Bin card', async () => {
    render(ui());

    fireEvent.click(card(TRASH));
    fireEvent.click(confirm());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toBe('/api/movies/m1?files=trash');
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

  it('draws no cards for a shared film, and reads that another title plays it', () => {
    render(ui({ linkedFiles: 'shared' }));

    expect(within(dialog()).queryAllByRole('radio')).toEqual([]);
    expect(itemsOf('What stays')).toEqual([
      'Its video file(s), which another title plays',
    ]);
    expect(within(dialog()).queryByText(CALLOUT)).toBeNull();
  });

  it('draws no cards for a copied film, FamilyFlix’s copy under What goes', () => {
    render(ui({ linkedFiles: null }));

    expect(within(dialog()).queryAllByRole('radio')).toEqual([]);
    expect(itemsOf('What goes')).toEqual([
      ...SHARED_GOES,
      'FamilyFlix’s copy of its video and subtitles',
    ]);
  });
});

describe('DeleteMovieDialog: the Delete facts, as Manage library reads them', () => {
  it('names an unreachable linked film’s path under What stays', () => {
    render(ui({ linkedFiles: 'unreachable' }));

    expect(itemsOf('What stays')).toEqual([
      `Its files on ${NORTHWIND_PATH} — they can’t be reached right now`,
    ]);
  });

  it('keeps a copied film’s original under What stays', () => {
    render(
      ui({ linkedFiles: null, originalPath: 'D:/Films/Northwind (2004)' })
    );

    expect(itemsOf('What stays')).toEqual([
      'Your original in its library folder — Scan folders would bring it back',
    ]);
  });
});

describe('DeleteMovieDialog — the Recycle choice, in a browser', () => {
  it('draws no cards for a linked film, and keeps its files', async () => {
    render(ui());

    expect(within(dialog()).queryAllByRole('radio')).toEqual([]);
    expect(itemsOf('What stays')).toEqual([
      'Its video file(s), in your library folder',
    ]);

    fireEvent.click(confirm());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/movies/m1');
  });
});
