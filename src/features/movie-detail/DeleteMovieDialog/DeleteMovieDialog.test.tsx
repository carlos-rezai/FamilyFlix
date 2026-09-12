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
import { useEffect, useState } from 'react';

import { DeleteMovieDialog } from './DeleteMovieDialog';
import { theme } from '@/styles/theme';
import type { GenrePayload } from '@/types';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  noContentResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * The **Delete dialog**: the Modal, the fixed copy, the two buttons and the
 * hook. The Modal's own contract — the portal, the ✕, mounting only when open —
 * is tested with the Modal; what is left here is what makes this dialog *this*
 * dialog: which movie it names, what it says, and what confirming does.
 */
const BODY =
  'The movie leaves your library, and the video, poster and subtitles ' +
  'FamilyFlix copied are deleted. The original files are not touched.';

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

interface RenderDialogOptions {
  open?: boolean;
  title?: string;
  onClose?: () => void;
}

function renderDialog({
  open = true,
  title = 'Northwind',
  onClose = () => undefined,
}: RenderDialogOptions = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/movie/m1']}>
        <DeleteMovieDialog
          movieId="m1"
          title={title}
          open={open}
          onClose={onClose}
        />
      </MemoryRouter>
    </ThemeProvider>
  );
}

const dialog = () => screen.getByRole('dialog');
const confirmButton = () =>
  within(dialog()).getByRole('button', { name: 'Delete movie' });
const cancelButton = () =>
  within(dialog()).getByRole('button', { name: 'Cancel' });

describe('DeleteMovieDialog — the copy', () => {
  it('titles itself with the movie’s name, in the prototype’s quotes', () => {
    renderDialog({ title: 'Northwind' });

    expect(
      screen.getByRole('dialog', { name: 'Delete “Northwind”?' })
    ).toBeTruthy();
    expect(
      within(dialog()).getByRole('heading', { name: 'Delete “Northwind”?' })
    ).toBeTruthy();
  });

  it('names whichever movie it was handed', () => {
    renderDialog({ title: 'The Quiet Harbor' });

    expect(
      screen.getByRole('dialog', { name: 'Delete “The Quiet Harbor”?' })
    ).toBeTruthy();
  });

  it('says it can’t be undone, exactly', () => {
    renderDialog();

    expect(within(dialog()).getByText('This can’t be undone.')).toBeTruthy();
  });

  it('says what goes and what stays, exactly', () => {
    renderDialog();

    expect(within(dialog()).getByText(BODY)).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/delete/i)).toBeNull();
  });
});

describe('DeleteMovieDialog — the two buttons', () => {
  it('offers Delete movie and Cancel, in that order', () => {
    renderDialog();

    expect(comesBefore(confirmButton(), cancelButton())).toBe(true);
  });

  it('draws Delete movie as the danger button and Cancel as the secondary one', () => {
    renderDialog();

    // The two variants differ in what fills them: `danger` ink on the confirm,
    // `secondary`'s ordinary text on Cancel. #c97a6a and #f3ece0, as jsdom
    // reports them.
    expect(getComputedStyle(confirmButton()).color).toBe('rgb(201, 122, 106)');
    expect(getComputedStyle(cancelButton()).color).toBe('rgb(243, 236, 224)');
  });

  it('calls onClose from Cancel, and deletes nothing', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    fireEvent.click(cancelButton());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the delete from Delete movie', async () => {
    fetchMock.mockResolvedValue(noContentResponse());
    renderDialog();

    fireEvent.click(confirmButton());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toBe('/api/movies/m1');
    expect(init?.method?.toUpperCase()).toBe('DELETE');
  });
});

/**
 * A stand-in for the shelf the movie was opened from — a genre page that
 * fetches its payload on mount and lists what it was given. Real enough to
 * show the one thing that matters after a delete: the screen behind is
 * refetched, and the movie is not on it.
 */
function Shelf() {
  const [titles, setTitles] = useState<string[] | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/genre/Drama')
      .then((response) => response.json() as Promise<GenrePayload>)
      .then((payload) => {
        if (live) {
          setTitles(payload.movies.map((movie) => movie.title));
        }
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <>
      <h1>Drama</h1>
      <ul>
        {(titles ?? []).map((title) => (
          <li key={title}>{title}</li>
        ))}
      </ul>
    </>
  );
}

/**
 * The library as the server sees it: Northwind is on the Drama shelf until the
 * delete lands, and off it afterwards.
 */
function serveLibraryAndDelete() {
  let deleted = false;
  const northwind = makeMovie({ id: 'm1', title: 'Northwind' });
  const weepie = makeMovie({ id: 'm2', title: 'Weepie' });

  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if ((init?.method ?? 'GET').toUpperCase() === 'DELETE') {
      deleted = true;
      return Promise.resolve(noContentResponse());
    }
    if (url.startsWith('/api/genre/')) {
      const movies = deleted ? [weepie] : [northwind, weepie];
      return Promise.resolve(
        okResponse({
          genre: 'Drama',
          total: movies.length,
          movies,
        } satisfies GenrePayload)
      );
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

function renderFromShelf() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter
        initialEntries={['/', '/genre/Drama?sort=az', '/movie/m1']}
        initialIndex={2}
      >
        <LocationProbe />
        <Routes>
          <Route path="/" element={<h1>Your library</h1>} />
          <Route path="/genre/:name" element={<Shelf />} />
          <Route
            path="/movie/:id"
            element={
              <DeleteMovieDialog
                movieId="m1"
                title="Northwind"
                open
                onClose={() => undefined}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('DeleteMovieDialog — afterwards', () => {
  it('lands back on the shelf the movie was opened from, as it was left, without the movie', async () => {
    serveLibraryAndDelete();
    renderFromShelf();

    fireEvent.click(confirmButton());

    // One step back, not a fresh `/`: the shelf keeps the sort it was left with,
    // and it refetches on the way in, so the deleted card is not on it.
    await waitFor(() =>
      expect(screen.getByTestId('url').textContent).toBe('/genre/Drama?sort=az')
    );
    expect(await screen.findByText('Weepie')).toBeTruthy();
    expect(screen.queryByText('Northwind')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
