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
  notFoundResponse,
  okResponse,
  serverErrorResponse,
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

  it('names a title that carries its own quotation marks', () => {
    renderDialog({ title: 'The "Great" Escape' });

    expect(
      within(dialog()).getByRole('heading', {
        name: 'Delete “The "Great" Escape”?',
      })
    ).toBeTruthy();
    expect(
      screen.getByRole('dialog', { name: 'Delete “The "Great" Escape”?' })
    ).toBeTruthy();
  });

  it('wraps a very long title inside the card rather than widening it', () => {
    const long =
      'The Extraordinarily Long And Frankly Unreasonable Title Of A Film ' +
      'That Somebody In The Family Insisted On Keeping';
    renderDialog({ title: long });

    const heading = within(dialog()).getByRole('heading', {
      name: `Delete “${long}”?`,
    });

    // jsdom lays nothing out, so what can be checked is the rule that keeps
    // the card its 520px whatever the title: the heading breaks its words
    // rather than pushing the ✕ off the edge.
    expect(getComputedStyle(heading).overflowWrap).toBe('anywhere');
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

/**
 * A delete the test settles by hand, so the dialog can be looked at while the
 * request is still running — the form's "Adding…" precedent.
 */
function holdDelete() {
  let settle: (response: Response) => void = () => undefined;
  let refuse: (reason: Error) => void = () => undefined;
  fetchMock.mockReturnValue(
    new Promise<Response>((resolve, reject) => {
      settle = resolve;
      refuse = reject;
    })
  );
  return {
    settle: (response: Response) => settle(response),
    refuse: (reason: Error) => refuse(reason),
  };
}

const deletingButton = () =>
  within(dialog()).getByRole('button', { name: 'Deleting…' });

/**
 * The dialog as `EditMenu` hosts it: mounted for the life of the page, with
 * `open` held above it and dropped by Cancel. Dismissing closes the Modal; it
 * does not unmount the dialog, and so does not cancel the request it started.
 */
function Host() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <h1>Northwind</h1>
      <DeleteMovieDialog
        movieId="m1"
        title="Northwind"
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function renderHosted() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter
        initialEntries={['/', '/genre/Drama?sort=az', '/movie/m1']}
        initialIndex={2}
      >
        <LocationProbe />
        <Routes>
          <Route path="/" element={<h1>Your library</h1>} />
          <Route path="/genre/:name" element={<h1>Drama</h1>} />
          <Route path="/movie/:id" element={<Host />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

const url = () => screen.getByTestId('url').textContent;

/**
 * What confirming does: where it lands, what it reads while the request runs,
 * that a dismissal does not cancel it, and what a refusal leaves behind.
 */
describe('DeleteMovieDialog — confirming', () => {
  describe('afterwards', () => {
    it('lands back on the shelf the movie was opened from, as it was left, without the movie', async () => {
      serveLibraryAndDelete();
      renderFromShelf();

      fireEvent.click(confirmButton());

      // One step back, not a fresh `/`: the shelf keeps the sort it was left with,
      // and it refetches on the way in, so the deleted card is not on it.
      await waitFor(() =>
        expect(screen.getByTestId('url').textContent).toBe(
          '/genre/Drama?sort=az'
        )
      );
      expect(await screen.findByText('Weepie')).toBeTruthy();
      expect(screen.queryByText('Northwind')).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('in flight', () => {
    it('reads "Deleting…" and is disabled while the request runs', async () => {
      holdDelete();
      renderDialog();

      fireEvent.click(confirmButton());

      // The one place the delete shows its cost. The label says the work
      // started, and the disabled button is what stops a second request from an
      // impatient second press.
      await waitFor(() => expect(deletingButton()).toBeTruthy());
      expect((deletingButton() as HTMLButtonElement).disabled).toBe(true);
      expect(
        within(dialog()).queryByRole('button', { name: 'Delete movie' })
      ).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('keeps Cancel enabled while the request runs', async () => {
      holdDelete();
      renderDialog();

      fireEvent.click(confirmButton());

      await waitFor(() => expect(deletingButton()).toBeTruthy());
      expect((cancelButton() as HTMLButtonElement).disabled).toBe(false);
    });

    it('still closes from Cancel while the request runs', async () => {
      holdDelete();
      const onClose = vi.fn();
      renderDialog({ onClose });

      fireEvent.click(confirmButton());
      await waitFor(() => expect(deletingButton()).toBeTruthy());

      fireEvent.click(cancelButton());

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('still closes from the ✕ while the request runs', async () => {
      holdDelete();
      const onClose = vi.fn();
      renderDialog({ onClose });

      fireEvent.click(confirmButton());
      await waitFor(() => expect(deletingButton()).toBeTruthy());

      fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('still closes from Escape while the request runs', async () => {
      holdDelete();
      const onClose = vi.fn();
      renderDialog({ onClose });

      fireEvent.click(confirmButton());
      await waitFor(() => expect(deletingButton()).toBeTruthy());

      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: 'Escape',
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('dismissed mid-flight', () => {
    it('still goes back when a 204 lands after the dialog was dismissed', async () => {
      const request = holdDelete();
      renderHosted();

      fireEvent.click(confirmButton());
      await waitFor(() => expect(deletingButton()).toBeTruthy());

      // Dismissing closes the dialog and nothing more: the request keeps going,
      // and once the movie is gone its page has nothing left to show.
      fireEvent.click(cancelButton());
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(url()).toBe('/movie/m1');

      request.settle(noContentResponse());

      await waitFor(() => expect(url()).toBe('/genre/Drama?sort=az'));
    });

    it('still goes back when a 404 lands after the dialog was dismissed', async () => {
      const request = holdDelete();
      renderHosted();

      fireEvent.click(confirmButton());
      await waitFor(() => expect(deletingButton()).toBeTruthy());

      fireEvent.click(cancelButton());
      expect(screen.queryByRole('dialog')).toBeNull();

      request.settle(notFoundResponse('Unknown movie: m1'));

      await waitFor(() => expect(url()).toBe('/genre/Drama?sort=az'));
    });
  });

  describe('failure', () => {
    it('re-enables Delete movie on a 500 and leaves the dialog open, in place', async () => {
      const request = holdDelete();
      renderHosted();

      fireEvent.click(confirmButton());
      await waitFor(() => expect(deletingButton()).toBeTruthy());

      request.settle(serverErrorResponse());

      // The form's precedent: the prototype designs no error state on this
      // screen, so a refusal puts the button back and changes nothing else — no
      // navigation, no snackbar, the dialog still up for a second try.
      await waitFor(() => expect(confirmButton()).toBeTruthy());
      expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(url()).toBe('/movie/m1');
      expect(screen.queryByText(/error|failed|try again/i)).toBeNull();
    });

    it('re-enables Delete movie when there is no server, and stays put', async () => {
      const request = holdDelete();
      renderHosted();

      fireEvent.click(confirmButton());
      await waitFor(() => expect(deletingButton()).toBeTruthy());

      request.refuse(new TypeError('Failed to fetch'));

      await waitFor(() => expect(confirmButton()).toBeTruthy());
      expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(url()).toBe('/movie/m1');
    });

    it('sends the delete again from the re-enabled button', async () => {
      const request = holdDelete();
      renderHosted();

      fireEvent.click(confirmButton());
      await waitFor(() => expect(deletingButton()).toBeTruthy());
      request.settle(serverErrorResponse());
      await waitFor(() => expect(confirmButton()).toBeTruthy());

      fetchMock.mockResolvedValue(noContentResponse());
      fireEvent.click(confirmButton());

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(url()).toBe('/genre/Drama?sort=az'));
    });
  });
});
