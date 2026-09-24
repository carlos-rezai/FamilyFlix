import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';

import App from './App';
import type {
  GenrePayload,
  HomePayload,
  HomeRow,
  ImportProblem,
  ImportProblemDetail,
  ImportRun,
  Movie,
  Series,
  SeriesDetail,
  SeriesHomePayload,
} from '@/types';
import {
  LocationProbe,
  pathname,
  search,
} from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { stubMediaElement } from '@/test-support/stubMediaElement/stubMediaElement';
import { snackbarStack } from '@/test-support/snackbarStack/snackbarStack';
import { stubScrollMetrics } from '@/test-support/stubScrollMetrics/stubScrollMetrics';

/** The two of Action the home row ships, of however many the genre holds. */
const ACTION_SHIPPED: Movie[] = [
  makeMovie({ id: 'a1', title: 'Northwind' }),
  makeMovie({ id: 'a2', title: 'Ironclad' }),
];

/** The one of Science Fiction the home row ships, of its four. */
const SCI_FI_SHIPPED: Movie[] = [
  makeMovie({ id: 's1', title: 'Quiet Harbor' }),
];

/**
 * Enough of Action to be a grid, which is all any test but one needs. This file
 * renders real `PosterCard`s through jsdom, and materialising a genre of 214 for
 * tests that only wanted a heading is what made it the slowest file in the
 * suite — slow enough that two of its tests crossed vitest's default timeout
 * under a full parallel run.
 */
const ACTION_SAMPLE = 8;

/**
 * How many movies Action holds. A variable because exactly one test is about
 * the number — the grid being uncapped — and it grows the genre for itself, so
 * the home row's count, the "View all" label and the grid all move together the
 * way the server moves them. See `materialiseWholeOfAction`.
 */
let actionTotal: number;

/**
 * A home payload as `GET /api/home` returns it. "Science Fiction" is not in
 * today's seeded 12-genre pool, but the genre name is user data that lands in a
 * URL — the row is here so the round-trip through `/genre/:name` is pinned
 * before the TMDB genre vocabulary (which does contain spaces) arrives.
 *
 * A row's `count` is the genre's whole tally from `listGenres()`, not the length
 * of the handful it ships, which is why "View all" has a number on it at all.
 */
function homeRows(): HomeRow[] {
  return [
    { genre: 'Action', count: actionTotal, movies: ACTION_SHIPPED },
    {
      genre: 'Science Fiction',
      count: SCI_FI_MOVIES.length,
      movies: SCI_FI_SHIPPED,
    },
  ];
}

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

/**
 * Action as `GET /api/genre/Action` answers it, uncapped: the two the home row
 * shipped, then `a3` upward to the genre's total.
 */
function actionMovies(total: number): Movie[] {
  return [
    ...ACTION_SHIPPED,
    ...Array.from({ length: total - ACTION_SHIPPED.length }, (_, index) =>
      makeMovie({ id: `a${index + 3}`, title: `Action ${index + 3}` })
    ),
  ];
}

/** Science Fiction’s whole genre — a name with a space, with a screen behind it. */
const SCI_FI_MOVIES: Movie[] = [
  ...SCI_FI_SHIPPED,
  makeMovie({ id: 's2', title: 'Orbital Drift' }),
  makeMovie({ id: 's3', title: 'The Long Night' }),
  makeMovie({ id: 's4', title: 'Zenith' }),
];

/**
 * The movies behind each genre route, rebuilt for every test so the one test
 * that materialises the whole of Action cannot leave 214 cards to the next.
 */
let genreMovies: Record<string, Movie[]>;

/**
 * Grows Action to the 214 the "View all" label promises, for the one test that
 * is about that promise being kept. Every other test is served `ACTION_SAMPLE`.
 */
function materialiseWholeOfAction() {
  actionTotal = 214;
  genreMovies.Action = actionMovies(actionTotal);
}

/**
 * The genre route, standing in for the server: it owns the narrowing and the
 * order, and `total` stays the genre’s unfiltered count however far a search
 * narrows the list.
 */
function genreResponse(url: string): Response {
  const [path, query] = url.split('?');
  const name = decodeURIComponent(path.slice(path.lastIndexOf('/') + 1));
  const params = new URLSearchParams(query ?? '');
  const all = genreMovies[name] ?? [];

  const search = params.get('q');
  const matched =
    search === null
      ? all
      : all.filter((movie) =>
          movie.title.toLowerCase().includes(search.toLowerCase())
        );

  const movies =
    params.get('sort') === 'a-z'
      ? [...matched].sort((left, right) =>
          left.title.localeCompare(right.title)
        )
      : matched;

  const payload: GenrePayload = { genre: name, total: all.length, movies };
  return okResponse(payload);
}

/** Every movie the fixture rows hold, as the detail route serves them by id. */
const MOVIES = [...ACTION_SHIPPED, ...SCI_FI_SHIPPED];

beforeEach(() => {
  actionTotal = ACTION_SAMPLE;
  genreMovies = {
    Action: actionMovies(actionTotal),
    'Science Fiction': SCI_FI_MOVIES,
  };
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  // The home aggregate always succeeds here; a favorite save always succeeds;
  // one movie by id resolves against the same fixtures the rows are built from.
  // Anything else is a request this screen has no business making.
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (url.endsWith('/api/movies') && init?.method === 'POST') {
      // The movie form's save. What it wrote is not what any test above is
      // about — only that it succeeded, and that the screen it lands on is a
      // *fresh* entry for `/`.
      return Promise.resolve(
        createdResponse(makeMovie({ id: 'n1', title: 'Saved Film' }))
      );
    }
    if (url.includes('/api/home')) {
      // The named-section envelope (issue #18); routing reads only `rows`.
      const payload: HomePayload = {
        continueWatching: [],
        favorites: [],
        rows: homeRows(),
      };
      return Promise.resolve(okResponse(payload));
    }
    if (url.includes('/api/genre/')) {
      return Promise.resolve(genreResponse(url));
    }
    if (url.includes('/favorite')) {
      return Promise.resolve(okResponse({ value: true }));
    }
    if (url.includes('/api/movies/')) {
      const id = url.slice(url.lastIndexOf('/') + 1);
      const movie = MOVIES.find((candidate) => candidate.id === id);
      if (movie) {
        return Promise.resolve(okResponse(movie));
      }
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

stubScrollMetrics(6390);

/**
 * Stands in for the browser's own Back button, which is the same history step
 * the chrome has no control over. Named without the word "back" so it never
 * answers a query meant for the movie page's own Back pill.
 */
function HistoryProbe() {
  const navigate = useNavigate();

  return (
    <button type="button" onClick={() => navigate(-1)}>
      history step
    </button>
  );
}

function renderApp(entry = '/') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
      <LocationProbe />
      <HistoryProbe />
    </MemoryRouter>
  );
}

/** The card for one movie — clicking its title bubbles to the card itself. */
function cardFor(title: string) {
  return screen.getAllByText(title)[0];
}

/**
 * Whichever Back is on screen — one route renders at a time, so there is only
 * ever one. Named exactly: the Library rows carry their own descriptions, and
 * "…spreadsheet backup." answers to /back/i.
 */
async function pressBack() {
  fireEvent.click(await screen.findByRole('button', { name: 'Back' }));
}

describe('App — routing the browse home to its destinations', () => {
  it('renders the browse home at /', async () => {
    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'Action' })
    ).toBeDefined();
    expect(pathname()).toBe('/');
  });

  it('navigates to /movie/:id when a poster card is clicked, and that movie’s page renders', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });

    fireEvent.click(cardFor('Northwind'));

    expect(pathname()).toBe('/movie/a1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Northwind' })
    ).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Action' })).toBeNull();
  });

  it('navigates to /genre/:name when “View all” is clicked, and the genre page echoes the name', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });

    const action = within(screen.getByRole('region', { name: 'Action' }));
    fireEvent.click(action.getByRole('button', { name: /view all/i }));

    expect(pathname()).toBe('/genre/Action');
    expect(
      await screen.findByRole('heading', { name: /Action/ })
    ).toBeDefined();
  });

  it('encodes a genre name for the URL and echoes it back decoded', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });

    const sciFi = within(
      screen.getByRole('region', { name: 'Science Fiction' })
    );
    fireEvent.click(sciFi.getByRole('button', { name: /view all 4/i }));

    expect(pathname()).toBe('/genre/Science%20Fiction');
    expect(
      await screen.findByRole('heading', { name: /Science Fiction/ })
    ).toBeDefined();
  });

  it('renders the settings screen at /settings', async () => {
    renderApp('/settings');

    expect(
      await screen.findByRole('heading', { name: /settings/i })
    ).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Action' })).toBeNull();
  });

  it('renders the movie itself when /movie/:id is opened directly', async () => {
    // The detail page loads from the URL alone, so a deep link renders the same
    // screen a click does — nothing arrives through navigation state.
    renderApp('/movie/a1');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Northwind' })
    ).toBeDefined();
  });

  it('leaves the movie page’s Back control reachable without a mouse', async () => {
    renderApp('/movie/a1');
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });

    const back = screen.getByRole('button', { name: /back/i });
    back.focus();
    expect(document.activeElement).toBe(back);

    fireEvent.click(back);

    expect(pathname()).toBe('/');
    // Back lands on the browse home, which loads. Wait for the rows the trip
    // was for, rather than leaving the fetch to resolve into a tree the next
    // test has already torn down.
    await screen.findByRole('heading', { name: 'Action' });
  });

  it('does not open the movie when the favorite heart is clicked', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });

    const action = within(screen.getByRole('region', { name: 'Action' }));
    fireEvent.click(action.getAllByRole('button', { name: /favorite/i })[0]);

    expect(pathname()).toBe('/');
    expect(screen.queryByRole('heading', { name: /a1/ })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Action' })).toBeDefined();
  });
});

/**
 * The movie page's two navigating actions. Both `/add` and `/movie/:id/play`
 * were registered as placeholders before their screens existed — the device
 * that made `/movie/:id` itself an honest link two features ago — and both
 * now have the real screen behind them, which arrived without a single link
 * changing, which was the whole point of registering the URL early.
 */
describe('App — the movie page’s navigating actions', () => {
  // The player behind `/movie/:id/play` drives a media element, and jsdom
  // has none: `play()` returns nothing at all there, so without the stub the
  // two tests that open the player die inside the hook rather than asserting.
  stubMediaElement();

  it('renders the player when /movie/:id/play is opened directly', async () => {
    // 10 — Video player, Phase 2 (issue #84): the placeholder is gone, and the
    // routed movie still survives the URL — now visibly, as the stream the
    // element is pointed at rather than as an echo of the id.
    const { container } = renderApp('/movie/a1/play');

    await waitFor(() =>
      expect(container.querySelector('video')).not.toBeNull()
    );
    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/api/movies/a1/stream'
    );
  });

  it('renders the player on the episode when /episode/:id/play is opened directly', async () => {
    // 22 — Series (TV), Phase 4 (issue #194): the route table hands the same
    // `PlayerPage` `kind="episode"`, so the stream is the episode's own.
    const fallThrough = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url === '/api/episodes/e24/playback') {
        return Promise.resolve(
          okResponse({ path: 'direct', durationSeconds: 2640 })
        );
      }
      if (url === '/api/episodes/e24') {
        return Promise.resolve(
          okResponse({
            episode: {
              id: 'e24',
              seriesId: 'harbor',
              season: 2,
              number: 4,
              title: 'The Auction',
              airDate: null,
              runtimeMinutes: 44,
              watched: false,
              resumePositionSeconds: 0,
              status: 'unwatched',
              videoPath: 'harbor/S02E04.mp4',
              subtitles: [],
              lastWatchedAt: null,
            },
            series: { id: 'harbor', title: 'Harbor & Vine' },
            next: null,
          })
        );
      }
      return fallThrough
        ? fallThrough(input, init)
        : Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    const { container } = renderApp('/episode/e24/play');

    await waitFor(() =>
      expect(container.querySelector('video')).not.toBeNull()
    );
    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/api/episodes/e24/stream'
    );
    expect(
      await screen.findByText('Harbor & Vine · S02E04 · The Auction')
    ).toBeDefined();
  });

  it('renders the movie form when /add is opened directly', async () => {
    renderApp('/add');

    expect(await screen.findByRole('heading', { name: /add/i })).toBeDefined();
  });

  it('sends Play to the player route for the movie being looked at', async () => {
    const { container } = renderApp('/movie/a1');
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(pathname()).toBe('/movie/a1/play');
    // Pressing Play on Northwind plays Northwind: the button, the URL and the
    // stream all name the same film.
    await waitFor(() =>
      expect(container.querySelector('video')).not.toBeNull()
    );
    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/api/movies/a1/stream'
    );
  });

  it('opens Edit details on the form, pre-filled with that movie', async () => {
    renderApp('/movie/a1');
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });

    fireEvent.click(screen.getByRole('button', { name: /more options/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /edit details/i }));

    // Story 5, end to end and through the real router: the menu item that has
    // said "Edit details" since #26 now does what it says. There is no `/edit`
    // route — `?movie=` is how the prototype edits, and the screen it lands on
    // is the same one that adds, doing the other job.
    expect(pathname()).toBe('/add');
    expect(search()).toBe('?movie=a1');
    expect(
      await screen.findByRole('heading', { name: 'Edit details' })
    ).toBeDefined();
    await waitFor(() =>
      expect(
        (screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement)
          .value
      ).toBe('Northwind')
    );
  });
});

/**
 * The one acceptance criterion issue #25 left behind: leaving the browse home
 * and coming back lands where the parent was, not at the top. The document never
 * scrolls — the body under the header does — so nothing the browser or the
 * router offers covers this, and these are the tests that say what "covered"
 * means: the position after a back navigation, never where it was stored.
 */
describe('App — returning the browse home to where the parent was', () => {
  /** What a parent does with a wheel: the body moves, and it says so. */
  function scrollTo(element: HTMLElement, top: number) {
    element.scrollTop = top;
    fireEvent.scroll(element);
  }

  /** The browse home's scrolling body: the one thing the header is followed by. */
  function homeBody() {
    return screen.getByRole('banner').nextElementSibling as HTMLElement;
  }

  it('lands where the parent was when Back is pressed on a movie, and starts a deliberate trip home at the top', async () => {
    // The case from the issue: scrolled down to the Action row, opened a movie.
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });
    scrollTo(homeBody(), 1240);

    fireEvent.click(cardFor('Northwind'));
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/');
    await screen.findByRole('heading', { name: 'Action' });
    expect(homeBody().scrollTop).toBe(1240);

    // Being *sent* to the home screen is a fresh visit — a new history entry
    // rather than the scrolled one — so it starts at the top. The vehicle is a
    // finished save, because that is the only deliberate trip home the app has:
    // this used to press the header logo on the Settings screen, and the real
    // Settings screen (issue #98) has no app header for it to press.
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('heading', { name: /settings/i });
    fireEvent.click(screen.getByRole('button', { name: 'Add a movie' }));
    fireEvent.change(await screen.findByRole('textbox', { name: /title/i }), {
      target: { value: 'Saved Film' },
    });
    await pickVideo();
    fireEvent.click(screen.getByRole('button', { name: /add to library/i }));

    await waitFor(() => expect(pathname()).toBe('/'));
    await screen.findByRole('heading', { name: 'Action' });
    expect(homeBody().scrollTop).toBe(0);
  });

  it('lands where the parent was on a browser back from a genre page', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });
    scrollTo(homeBody(), 860);

    const action = within(screen.getByRole('region', { name: 'Action' }));
    fireEvent.click(action.getByRole('button', { name: /view all/i }));
    await screen.findByRole('heading', { name: /Action/ });
    fireEvent.click(screen.getByRole('button', { name: 'history step' }));

    expect(pathname()).toBe('/');
    await screen.findByRole('heading', { name: 'Action' });
    expect(homeBody().scrollTop).toBe(860);
  });
});

/**
 * 06 — Genre page, Phase 4: "the screen loads a real genre" (issue #47).
 * "View all" stops landing on a placeholder and starts keeping its promise.
 */
describe('App — the genre screen behind “View all”', () => {
  /** What a parent does with a wheel: the body moves, and it says so. */
  function scrollTo(element: HTMLElement, top: number) {
    element.scrollTop = top;
    fireEvent.scroll(element);
  }

  /** The scrolling body of whichever screen is up — what follows its header. */
  function screenBody() {
    return screen.getByRole('banner').nextElementSibling as HTMLElement;
  }

  /**
   * Every poster card on screen. A card is a button in the scrolling body
   * carrying a movie title as its accessible name, which the hearts beside them
   * do not — and the header is excluded outright, because its own controls
   * announce themselves too ("Sort: Recently Added") without being cards.
   */
  function posterCards() {
    return within(screenBody())
      .queryAllByRole('button')
      .filter((button) => {
        const label = button.getAttribute('aria-label');
        return label !== null && label !== 'Favorite';
      });
  }

  /** The accessible name of every poster card, in the order they are rendered. */
  function cardTitles() {
    return posterCards().map((card) => card.getAttribute('aria-label'));
  }

  it('opens every movie in the genre, uncapped, when “View all 214” is pressed', async () => {
    // The row shipped two of Action’s 214; the other 212 are reachable by no
    // other route in the app, which is what this screen is for. This is the one
    // test the number is about, so it is the one that pays to render it.
    materialiseWholeOfAction();

    renderApp();
    await screen.findByRole('heading', { name: 'Action' });

    const action = within(screen.getByRole('region', { name: 'Action' }));
    fireEvent.click(action.getByRole('button', { name: /view all 214/i }));

    expect(pathname()).toBe('/genre/Action');
    await screen.findByRole('heading', { level: 1, name: 'Action' });
    // The count line is the payload landing; the name was on screen before it.
    await screen.findByText('214 titles');
    expect(posterCards()).toHaveLength(214);
    expect(screen.getByRole('button', { name: 'Action 100' })).toBeDefined();
  });

  it('renders a deep-linked genre already narrowed and in its order', async () => {
    // A shared or bookmarked link loads the screen it names, with no
    // unnarrowed genre flashing past first.
    renderApp('/genre/Science%20Fiction?q=or&sort=a-z');

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Science Fiction',
      })
    ).toBeDefined();
    await screen.findByText('2 of 4 titles');
    expect(cardTitles()).toEqual(['Orbital Drift', 'Quiet Harbor']);
  });

  it('opens a movie’s detail page from a card on the genre screen', async () => {
    renderApp('/genre/Action');
    await screen.findByText('8 titles');

    fireEvent.click(cardFor('Northwind'));

    expect(pathname()).toBe('/movie/a1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Northwind' })
    ).toBeDefined();
  });

  it('lands back on the narrowed grid, where the parent left it', async () => {
    // The query lives in the URL and the offset with the chrome, so nothing
    // about the shelf was in a component to lose on the way to the movie.
    renderApp('/genre/Action?q=north&sort=a-z');
    await screen.findByText('1 of 8 titles');
    scrollTo(screenBody(), 1240);

    fireEvent.click(cardFor('Northwind'));
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/genre/Action');
    expect(search()).toBe('?q=north&sort=a-z');
    await screen.findByText('1 of 8 titles');
    expect(screenBody().scrollTop).toBe(1240);
  });
});

/**
 * 06 — Genre page, Phase 5: "the carried sort on View all" (issue #50). The
 * **Carried sort**, end to end: the order the parent put the library in is
 * still the order the genre page opens in, because "View all" carried it in
 * the link. `/genre/:name` is a different URL from `/`, so without this the
 * order is dropped back to Recently Added by nothing but a route change.
 *
 * Science Fiction is the genre under test because its four movies read
 * differently in the two orders, and its name has a space in it — the path
 * encoding and the carried parameter survive the same click.
 */
describe('App — the order carried from the home to the genre page', () => {
  /** The scrolling body of whichever screen is up — what follows its header. */
  function screenBody() {
    return screen.getByRole('banner').nextElementSibling as HTMLElement;
  }

  /**
   * The accessible name of every poster card, in the order they are rendered.
   * Scoped to the scrolling body, so the header's own announcing controls
   * ("Sort: Recently Added") are never mistaken for cards.
   */
  function cardTitles() {
    return within(screenBody())
      .queryAllByRole('button')
      .map((button) => button.getAttribute('aria-label'))
      .filter(
        (label): label is string => label !== null && label !== 'Favorite'
      );
  }

  /** How many times the browse home has been asked for. */
  function homeRequests() {
    return fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/api/home')
    ).length;
  }

  /** Put the library in one order the way a parent does — through the pill. */
  async function chooseSort(label: string) {
    const pill = screen.getByRole('button', { name: /^Sort: / });
    act(() => pill.focus());
    fireEvent.click(pill);
    fireEvent.click(screen.getByRole('menuitem', { name: label }));
    await waitFor(() => expect(homeRequests()).toBe(2));
  }

  it('opens the genre page in the order the home was in', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Science Fiction' });

    await chooseSort('Title (A–Z)');
    const sciFi = within(
      screen.getByRole('region', { name: 'Science Fiction' })
    );
    fireEvent.click(sciFi.getByRole('button', { name: /view all 4/i }));

    expect(pathname()).toBe('/genre/Science%20Fiction');
    expect(search()).toBe('?sort=a-z');
    await screen.findByText('4 titles');
    // The server owns the order; the grid renders the answer it gave.
    expect(cardTitles()).toEqual([
      'Orbital Drift',
      'Quiet Harbor',
      'The Long Night',
      'Zenith',
    ]);
    expect(
      screen.getByRole('button', { name: 'Sort: Title (A–Z)' })
    ).toBeDefined();
  });

  it('opens a clean genre page, in the library’s own order, at the default', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Science Fiction' });

    const sciFi = within(
      screen.getByRole('region', { name: 'Science Fiction' })
    );
    fireEvent.click(sciFi.getByRole('button', { name: /view all 4/i }));

    expect(pathname()).toBe('/genre/Science%20Fiction');
    expect(search()).toBe('');
    await screen.findByText('4 titles');
    expect(cardTitles()).toEqual([
      'Quiet Harbor',
      'Orbital Drift',
      'The Long Night',
      'Zenith',
    ]);
    expect(
      screen.getByRole('button', { name: 'Sort: Recently Added' })
    ).toBeDefined();
  });
});

/**
 * Fill the video half of the **Save gate** on the form that is on screen.
 *
 * Every walk through the form has to do this from #102 onward: a title alone
 * was the whole gate while there was no video slot to check, and a form that
 * can hold a film requires one. `applyAccept: false` because what the accept
 * list offers is asserted on the attribute, in the form's own suite.
 */
async function pickVideo(): Promise<void> {
  await userEvent.upload(
    screen.getByLabelText(/choose video file/i),
    new File(['video bytes'], 'lantern.mp4', { type: 'video/mp4' }),
    { applyAccept: false }
  );
}

// --- 11 — Movie form, Phase 1: the tracer bullet (issue #98) ------------------

/**
 * The whole demoable path in one test: press the gear, press ＋ Add a movie,
 * type a title, press Add to library, and the film is on the home screen.
 *
 * It is here rather than in any one unit's suite because none of them can prove
 * it. The route table, the gear, the Settings header, the form, the wire call
 * and the browse home's reload are six separate pieces, and a tracer bullet is
 * a claim about them joining up — the same claim the acceptance criteria make,
 * and the one thing that would still be broken with every unit test green.
 *
 * The stub stands in for the whole server: a library the POST appends to, and a
 * home aggregate rebuilt from it on every read. Nothing here simulates
 * multipart — that contract is `routes.test.ts`'s, over a real body.
 */
describe('App — a typed title becomes a row on the home screen', () => {
  /** The server's library, as this test's stub keeps it. */
  let library: Movie[];

  beforeEach(() => {
    library = [makeMovie({ id: 'a1', title: 'Northwind' })];
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);

      if (url.endsWith('/api/movies') && init?.method === 'POST') {
        const fields = init.body as FormData;
        const year = String(fields.get('year') ?? '');
        const created = makeMovie({
          id: `m${library.length + 1}`,
          title: String(fields.get('title')),
          year: year === '' ? null : Number(year),
          videoPath: '',
        });
        library = [...library, created];
        return Promise.resolve(createdResponse(created));
      }

      if (url.includes('/api/home')) {
        const payload: HomePayload = {
          continueWatching: [],
          favorites: [],
          rows: [{ genre: 'Action', count: library.length, movies: library }],
        };
        return Promise.resolve(okResponse(payload));
      }

      if (url.includes('/api/genres')) {
        return Promise.resolve(okResponse({ total: 0, genres: [] }));
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
  });

  it('walks the gear, the ＋, the form and the save through to the shelf', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });

    // The gear is the only door to any maintainer surface.
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(pathname()).toBe('/settings');
    await screen.findByRole('heading', { name: 'Settings' });

    // And ＋ Add a movie is the only door from there to the form.
    fireEvent.click(screen.getByRole('button', { name: 'Add a movie' }));
    expect(pathname()).toBe('/add');

    const title = await screen.findByRole('textbox', { name: /title/i });
    fireEvent.change(title, { target: { value: 'Rear Window' } });
    fireEvent.change(screen.getByRole('textbox', { name: /year/i }), {
      target: { value: '1954' },
    });
    await pickVideo();
    fireEvent.click(screen.getByRole('button', { name: /add to library/i }));

    // Landing on the browse home is where the maintainer sees it worked, and
    // the row is there without a reload because the screen loads on arrival.
    await waitFor(() => expect(pathname()).toBe('/'));
    // By the card's own name rather than by its text: a movie with no poster
    // draws its title twice — once over the gradient placeholder, once as the
    // caption — and every film added by this slice is a film with no poster.
    expect(
      await screen.findByRole('button', { name: 'Rear Window' })
    ).toBeDefined();
  });

  it('leaves the form by the back pill without writing anything', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('heading', { name: 'Settings' });
    // Exact: the Export row's line ends in "backup", and `/back/i` would find
    // it too.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/');
    await screen.findByRole('heading', { name: 'Action' });
    expect(screen.queryByText('Rear Window')).toBeNull();
  });
});

// --- 11 — Movie form, Phase 1: the chips (issue #99) --------------------------

/** The **Genre pool** as `GET /api/genres/pool` sends it — the 12, in migration order. */
const GENRE_POOL = [
  'Action',
  'Comedy',
  'Drama',
  'Horror',
  'Thriller',
  'Sci-Fi',
  'Romance',
  'Documentary',
  'Animation',
  'Family',
  'Adventure',
  'Crime',
].map((name, index) => ({ id: `g${index + 1}`, name }));

/**
 * The acceptance criterion no unit test can prove: a film filed under two
 * genres on the form is in **both** rows on the browse home, with no reload.
 *
 * The section above it walked the same path to a film that was in the library
 * and on no shelf, because `listGenres` reports only *populated* genres and
 * that slice had no genre control. This is the other half of that sentence, and
 * it needs all of it at once — the pool endpoint, the chips, the repeated
 * `genre` parts on the wire, the write, and a home aggregate rebuilt from what
 * the library now holds.
 *
 * The stub stands in for the whole server, and it keeps the server's own rule
 * about rows: a genre earns one by having a movie in it. Sci-Fi is not a row
 * when the test starts, which is the entire point of a pool that offers the
 * empty genres.
 */
describe('App — a film filed under two genres reaches both rows', () => {
  /** The server's library, as this test's stub keeps it. */
  let library: Movie[];

  /** The rows `/api/home` builds: one per populated genre, in first-seen order. */
  function rowsFrom(movies: Movie[]): HomeRow[] {
    const rows: HomeRow[] = [];
    for (const movie of movies) {
      for (const genre of movie.genres) {
        const row = rows.find((candidate) => candidate.genre === genre.name);
        if (row) {
          row.movies = [movie, ...row.movies];
          row.count += 1;
        } else {
          rows.push({ genre: genre.name, count: 1, movies: [movie] });
        }
      }
    }
    return rows;
  }

  beforeEach(() => {
    library = [
      makeMovie({
        id: 'a1',
        title: 'North by Northwest',
        genres: [{ id: 'g5', name: 'Thriller' }],
      }),
    ];

    fetchMock.mockImplementation((input, init) => {
      const url = String(input);

      if (url.endsWith('/api/movies') && init?.method === 'POST') {
        const fields = init.body as FormData;
        const created = makeMovie({
          id: `m${library.length + 1}`,
          title: String(fields.get('title')),
          videoPath: '',
          genres: fields.getAll('genre').map((name) => ({
            id: `g-${String(name)}`,
            name: String(name),
          })),
        });
        library = [created, ...library];
        return Promise.resolve(createdResponse(created));
      }

      if (url.includes('/api/genres/pool')) {
        return Promise.resolve(okResponse({ genres: GENRE_POOL }));
      }

      if (url.includes('/api/genres')) {
        // The **Genre list** behind the home's filter pill — populated genres
        // only, which is exactly why the form cannot be built on it.
        return Promise.resolve(
          okResponse({ total: library.length, genres: [] })
        );
      }

      if (url.includes('/api/home')) {
        const payload: HomePayload = {
          continueWatching: [],
          favorites: [],
          rows: rowsFrom(library),
        };
        return Promise.resolve(okResponse(payload));
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
  });

  /** Walk the gear and the ＋ to a form with its chips already loaded. */
  async function openForm() {
    renderApp();
    await screen.findByRole('heading', { name: 'Thriller' });

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('heading', { name: 'Settings' });
    fireEvent.click(screen.getByRole('button', { name: 'Add a movie' }));

    await screen.findByRole('button', { name: 'Documentary' });
  }

  /** The card for one film inside one genre row, or `null` if it is not there. */
  function cardInRow(genre: string, title: string) {
    return within(screen.getByRole('region', { name: genre })).queryByRole(
      'button',
      { name: title }
    );
  }

  it('puts the film in both of the rows it was filed under', async () => {
    await openForm();

    fireEvent.change(screen.getByRole('textbox', { name: /title/i }), {
      target: { value: 'Rear Window' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Thriller' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sci-Fi' }));
    await pickVideo();
    fireEvent.click(screen.getByRole('button', { name: /add to library/i }));

    await waitFor(() => expect(pathname()).toBe('/'));
    await screen.findByRole('region', { name: 'Sci-Fi' });

    // Both shelves, with no reload — the browse home loads on arrival, and the
    // film it loads is the one the save just wrote.
    expect(cardInRow('Thriller', 'Rear Window')).not.toBeNull();
    expect(cardInRow('Sci-Fi', 'Rear Window')).not.toBeNull();
  });

  it('draws a row for a genre that had none before the save', async () => {
    await openForm();

    // Sci-Fi is offerable while it is empty, which is the whole reason the pool
    // is read separately from the genre list.
    expect(screen.queryByRole('region', { name: 'Sci-Fi' })).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: /title/i }), {
      target: { value: 'Rear Window' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sci-Fi' }));
    await pickVideo();
    fireEvent.click(screen.getByRole('button', { name: /add to library/i }));

    await waitFor(() => expect(pathname()).toBe('/'));

    expect(await screen.findByRole('region', { name: 'Sci-Fi' })).toBeDefined();
  });

  it('joins the film to a row that was already there', async () => {
    await openForm();

    fireEvent.change(screen.getByRole('textbox', { name: /title/i }), {
      target: { value: 'Rear Window' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Thriller' }));
    await pickVideo();
    fireEvent.click(screen.getByRole('button', { name: /add to library/i }));

    await waitFor(() => expect(pathname()).toBe('/'));
    await waitFor(() =>
      expect(cardInRow('Thriller', 'Rear Window')).not.toBeNull()
    );

    // The film that was already on the shelf is still on it.
    expect(cardInRow('Thriller', 'North by Northwest')).not.toBeNull();
  });

  it('sends the chips as the genres it was given, and no others', async () => {
    await openForm();

    fireEvent.change(screen.getByRole('textbox', { name: /title/i }), {
      target: { value: 'Rear Window' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sci-Fi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thriller' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sci-Fi' }));
    await pickVideo();
    fireEvent.click(screen.getByRole('button', { name: /add to library/i }));

    await waitFor(() => expect(pathname()).toBe('/'));

    // Picked, picked, unpicked — one genre reaches the wire, in the order it
    // survived in.
    const save = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).endsWith('/api/movies') && init?.method === 'POST'
    );
    const fields = save?.[1]?.body as FormData;
    expect(fields.getAll('genre')).toEqual(['Thriller']);
  });

  it('leaves a film with no genre picked on no shelf at all', async () => {
    await openForm();

    fireEvent.change(screen.getByRole('textbox', { name: /title/i }), {
      target: { value: 'Rear Window' },
    });
    await pickVideo();
    fireEvent.click(screen.getByRole('button', { name: /add to library/i }));

    await waitFor(() => expect(pathname()).toBe('/'));
    await screen.findByRole('region', { name: 'Thriller' });

    // Unchanged from Phase 1, and still not a bug: every section of the home is
    // a genre row, the resume queue or the favorites shelf, so an unfiled film
    // is in the library and on none of them.
    expect(screen.queryAllByRole('region')).toHaveLength(1);
    expect(cardInRow('Thriller', 'Rear Window')).toBeNull();
  });
});

// --- 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125) ------------

/**
 * The second maintainer surface, reached the same way as the first: the gear,
 * then the Library section's ⇪ Import from spreadsheet row. `/import` is a
 * real route with the real screen behind it from its first commit — the
 * device the movie form used, without the placeholder step.
 *
 * And the mirror of that: nothing the **Family** sees leads to an import. The
 * browse home, a card, the movie page and the player carry no control that
 * names one, which is asserted here because the route table and the family
 * screens are only ever composed together in `App`.
 */
describe('App — the import flow behind the gear', () => {
  it('renders the import screen at /import', async () => {
    renderApp('/import');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Import library' })
    ).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Spreadsheet' })).toBeDefined();
    expect(pathname()).toBe('/import');
  });

  it('walks the gear and ⇪ Import from spreadsheet to the import screen', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('heading', { name: 'Settings' });
    fireEvent.click(
      screen.getByRole('button', { name: /import from spreadsheet/i })
    );

    expect(pathname()).toBe('/import');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Import library' })
    ).toBeDefined();
  });

  it('returns to Settings from the import screen’s Back', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('heading', { name: 'Settings' });
    fireEvent.click(
      screen.getByRole('button', { name: /import from spreadsheet/i })
    );
    await screen.findByRole('heading', { level: 1, name: 'Import library' });

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(pathname()).toBe('/settings');
    expect(
      await screen.findByRole('heading', { name: 'Settings' })
    ).toBeDefined();
  });
});

describe('App — no import control on the family’s screens', () => {
  // The player behind `/movie/:id/play` drives a media element, and jsdom
  // has none.
  stubMediaElement();

  /** Any control or link that names an import, anywhere on the screen. */
  const importControls = () => [
    ...screen.queryAllByRole('button', { name: /import/i }),
    ...screen.queryAllByRole('link', { name: /import/i }),
  ];

  it('offers none on the browse home or its cards', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });
    await screen.findByRole('button', { name: 'Northwind' });

    expect(importControls()).toHaveLength(0);
  });

  it('offers none on the movie page', async () => {
    renderApp('/movie/a1');
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });

    expect(importControls()).toHaveLength(0);
  });

  it('offers none in the player', async () => {
    const { container } = renderApp('/movie/a1/play');
    await waitFor(() =>
      expect(container.querySelector('video')).not.toBeNull()
    );

    expect(importControls()).toHaveLength(0);
  });
});

describe('App — the Snackbar stack above the route table', () => {
  /**
   * Present on every screen means the provider is mounted above the routes
   * rather than inside one of them — the single failure mode no other test can
   * see. What the stack does when a notice lands is the provider's own suite.
   */
  it('mounts the stack’s node on /, /movie/:id, /settings and /import alike', async () => {
    const home = renderApp();
    await screen.findByRole('heading', { name: 'Action' });
    expect(snackbarStack()).toBeDefined();
    home.unmount();

    const movie = renderApp('/movie/a1');
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });
    expect(snackbarStack()).toBeDefined();
    movie.unmount();

    const settings = renderApp('/settings');
    await screen.findByRole('heading', { name: /settings/i });
    expect(snackbarStack()).toBeDefined();
    settings.unmount();

    renderApp('/import');
    await screen.findByRole('heading', { level: 1, name: 'Import library' });
    expect(snackbarStack()).toBeDefined();
  });
});

/**
 * 20 — Back navigation, Phase 2: "the player steps" (issue #172).
 *
 * The three symptoms reproduced in the browser on 2026-09-21, as the journeys
 * a parent and a maintainer actually make: the film's page comes back where it
 * was left, the shelf behind it comes back filtered and scrolled, and a delete
 * after a visit to the player lands on the library rather than on the player of
 * a film that no longer exists.
 *
 * They live here rather than beside the player because the screens they are
 * about are the real ones: `MoviePage`'s own scroll container, `MainLayout`'s
 * body, `useDeleteMovie`'s own step. Two of those three are untouched by this
 * slice, which is the point — the player's leaving is the only thing that
 * changes, and everything downstream of it comes right on its own.
 */
describe('App — coming back out of the player', () => {
  // jsdom has no media, so the player dies inside its hook without this.
  stubMediaElement();

  /** What a parent does with a wheel: the body moves, and it says so. */
  function scrollTo(element: HTMLElement, top: number) {
    element.scrollTop = top;
    fireEvent.scroll(element);
  }

  /** The browse home's scrolling body: the one thing the header is followed by. */
  function homeBody() {
    return screen.getByRole('banner').nextElementSibling as HTMLElement;
  }

  /** The movie page's scroller — the element its Back pill sits inside. */
  function detailBody() {
    return screen.getByRole('button', { name: 'Back' })
      .parentElement as HTMLElement;
  }

  it('returns the film’s page to where it was left', async () => {
    renderApp('/movie/a1');
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });
    scrollTo(detailBody(), 720);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(pathname()).toBe('/movie/a1/play');
    await pressBack();

    await screen.findByRole('heading', { level: 1, name: 'Northwind' });
    // `useRestoredScroll` is not touched by this slice and does not need to be:
    // it keys on the history entry, and a step lands on the entry it
    // remembered, while the push it replaces was a fresh one starting at 0.
    expect(detailBody().scrollTop).toBe(720);
  });

  it('lands back on the library still filtered and still scrolled, two Backs later', async () => {
    renderApp('/?q=north&sort=a-z');
    await screen.findByRole('heading', { name: 'Action' });
    scrollTo(homeBody(), 1240);

    fireEvent.click(cardFor('Northwind'));
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await pressBack();
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });
    await pressBack();

    await waitFor(() => expect(pathname()).toBe('/'));
    expect(search()).toBe('?q=north&sort=a-z');
    await screen.findByRole('heading', { name: 'Action' });
    expect(homeBody().scrollTop).toBe(1240);
  });

  it('takes a delete after a visit to the player back to the library', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });

    fireEvent.click(cardFor('Northwind'));
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await pressBack();
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });

    fireEvent.click(screen.getByRole('button', { name: /more options/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /delete movie/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete movie' }));

    // `useDeleteMovie` is untouched: its own step lands on the library because
    // the entry behind the film's page is the library again, rather than the
    // player the push used to leave there.
    await waitFor(() => expect(pathname()).toBe('/'));
  });
});

/**
 * 20 — Back navigation, Phase 3: "the Import steps" (issue #173).
 *
 * The maintainer's journey as they actually make it: the gear, Import from
 * spreadsheet, and back out again. Both Backs are real screens' own — Import's
 * pill and the Settings header's — which is why this lives here rather than
 * beside `ImportFlow`: the duplicate `/settings` entry Import's push leaves
 * behind is only ever pressed by the *hub's* Back, and the two are only ever
 * composed together in `App`.
 *
 * Reproduced in the browser on 2026-09-21: the second Back walked back into
 * Import instead of out to the library.
 */
describe('App — coming back out of Import', () => {
  it('walks back out to the library the gear was pressed on', async () => {
    renderApp('/?q=north&sort=a-z');
    await screen.findByRole('heading', { name: 'Action' });

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('heading', { name: 'Settings' });
    fireEvent.click(
      screen.getByRole('button', { name: /import from spreadsheet/i })
    );
    await screen.findByRole('heading', { level: 1, name: 'Import library' });

    await pressBack();
    await screen.findByRole('heading', { name: 'Settings' });
    await pressBack();

    await waitFor(() => expect(pathname()).toBe('/'));
    // The shelf as the maintainer left it: Settings' Back was always a step,
    // and now it steps onto the entry the gear was pressed from rather than
    // onto the second `/settings` Import's push had left behind.
    expect(search()).toBe('?q=north&sort=a-z');
    await screen.findByRole('heading', { name: 'Action' });
  });
});

/**
 * 20 — Back navigation, Phase 4: "the form's landing, and the edit and add
 * contexts" (issue #174).
 *
 * The maintainer's correction, as they actually make it: a film off the shelf,
 * _Edit details_, _Save changes_, and back out. The film's page is the entry
 * behind the form already, so the push _Save changes_ used to make left a
 * second copy of it — and the next Back walked into the form the correction was
 * just finished in.
 *
 * It lives here rather than beside `MovieForm` because the second press is the
 * *movie page's* Back, and the two screens are only ever composed together in
 * `App`.
 */
describe('App — coming back out of an edit', () => {
  it('walks back out to the shelf the film was opened from', async () => {
    renderApp('/?q=north&sort=a-z');
    await screen.findByRole('heading', { name: 'Action' });

    fireEvent.click(cardFor('Northwind'));
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });
    fireEvent.click(screen.getByRole('button', { name: /more options/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /edit details/i }));
    await screen.findByRole('heading', { name: 'Edit details' });
    await waitFor(() =>
      expect(
        (screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement)
          .value
      ).toBe('Northwind')
    );

    fireEvent.change(screen.getByRole('textbox', { name: /title/i }), {
      target: { value: 'Northwind (restored)' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    // The save lands where it always did — the page the correction is visible
    // on — and now by stepping onto the entry the form was opened from.
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });
    expect(pathname()).toBe('/movie/a1');

    await pressBack();

    // The press that used to walk back into the form. The shelf comes back as
    // the maintainer left it, filtered and sorted, because a step returns the
    // entry rather than making a new one.
    await waitFor(() => expect(pathname()).toBe('/'));
    expect(search()).toBe('?q=north&sort=a-z');
    await screen.findByRole('heading', { name: 'Action' });
  });
});

/**
 * 20 — Back navigation, Phase 5: "the form in Import context" (issue #175).
 *
 * The maintainer's longest journey, as they actually make it: the gear, Import
 * from spreadsheet, a row in **Needs attention**, _Resolve_, _Save & continue_,
 * and back out. Four screens, three of them real, and the two presses that
 * matter are a whole screen apart — which is why this lives here rather than
 * beside `MovieForm`: the duplicate `/import` entry the form's push left behind
 * is only ever pressed by *Import's* own Back.
 *
 * It is also the one place the **Review step**'s survival can be read. The step
 * lands on the `/import` entry the maintainer already visited, and the row it
 * just fixed is gone from the list anyway — because the review is the **Current
 * run**'s state rather than the entry's, and `useImportRun` re-attaches on
 * mount.
 */
describe('App — coming back out of a Resolve', () => {
  /** The one row the run could not settle, as the Review step lists it. */
  const PROBLEM: ImportProblem = {
    id: 'p1',
    kind: 'no-video',
    title: 'Die Hard',
    reason: 'No video file under the folder.',
  };

  /** The same row as _Resolve_ reads it, with a film to fill the gate. */
  const DETAIL: ImportProblemDetail = {
    ...PROBLEM,
    row: { title: 'Die Hard', year: 1988, genres: [] },
    folder: 'C:\\Movies\\Die Hard (1988)',
    candidates: [],
    files: {
      video: 'C:\\Movies\\Die Hard (1988)\\Die.Hard.1988.mp4',
      subtitles: [],
    },
  };

  /** The **Current run** in review, holding whatever is still unsettled. */
  const reviewRun = (problems: ImportProblem[]): ImportRun => ({
    id: 'run-1',
    phase: 'review',
    startedAt: '2026-09-22T10:00:00.000Z',
    found: 2,
    total: 2,
    done: 2,
    matched: 1,
    currentItem: '',
    log: [],
    problems,
  });

  /** Whether the resolve has been made: the run answers differently after it. */
  let resolved: boolean;

  beforeEach(() => {
    resolved = false;
    const base = fetchMock.getMockImplementation();
    // Three more arms in front of the file's own: the current run on every
    // visit to `/import`, the problem detail the form prefills from, and the
    // resolve. Everything else — the hub's four reads, the genre pool — is a
    // request this journey has no business answering, and every screen on it
    // draws nothing while a read has not landed.
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method?.toUpperCase() ?? 'GET';
      if (url.includes('/api/import/current/problems/')) {
        if (method === 'POST') {
          resolved = true;
          return Promise.resolve(
            createdResponse(makeMovie({ id: 'd1', title: 'Die Hard' }))
          );
        }
        return Promise.resolve(okResponse(DETAIL));
      }
      if (url.includes('/api/import/current')) {
        return Promise.resolve(
          okResponse(reviewRun(resolved ? [] : [PROBLEM]))
        );
      }
      return base === undefined
        ? Promise.reject(new Error(`Unexpected request: ${url}`))
        : base(input, init);
    });
  });

  const resolveLink = () => screen.queryByRole('link', { name: 'Resolve' });

  it('walks back out to the hub the import was started from', async () => {
    renderApp('/');
    await screen.findByRole('heading', { name: 'Action' });

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('heading', { name: 'Settings' });
    fireEvent.click(
      screen.getByRole('button', { name: /import from spreadsheet/i })
    );
    await screen.findByRole('heading', { level: 1, name: 'Import library' });

    // The Review step, with the one row the run could not settle.
    fireEvent.click(await screen.findByRole('link', { name: 'Resolve' }));
    const saveAndContinue = await screen.findByRole('button', {
      name: /save & continue/i,
    });
    expect(pathname()).toBe('/add');

    fireEvent.click(saveAndContinue);

    // Back on the review — the entry the form was opened from, rather than a
    // second copy of it — and the row that was fixed is gone from the list
    // without the screen asking anyone where it had been.
    await screen.findByRole('heading', { level: 1, name: 'Import library' });
    expect(pathname()).toBe('/import');
    await waitFor(() => expect(resolveLink()).toBeNull());

    await pressBack();

    // The press that used to walk back into the form of a row already fixed.
    await screen.findByRole('heading', { name: 'Settings' });
    expect(pathname()).toBe('/settings');
  });
});

/**
 * 22 — Series (TV), Phase 2 (issue #191): the series page. `/series/:id` is a
 * route of its own; a Series tab poster opens it, and Back from it reaches the
 * Series tab filtered and scrolled as it was left — the movie page's rule, the
 * History step landing on the entry `useRestoredScroll` remembered.
 */
describe('App — the series page', () => {
  function makeSeries(overrides: Partial<Series> = {}): Series {
    return {
      id: 'sv1',
      tmdbId: null,
      title: 'Harbor & Vine',
      year: 2019,
      endYear: 2023,
      synopsis: null,
      creator: 'Mara Quinn',
      cast: [],
      rating: 8,
      isFavorite: false,
      posterPath: null,
      backdropPath: null,
      genres: [],
      watched: false,
      createdAt: '2026-09-23T00:00:00.000Z',
      updatedAt: '2026-09-23T00:00:00.000Z',
      ...overrides,
    };
  }

  const SERIES: Series[] = [
    makeSeries({ id: 'sv1', title: 'Harbor & Vine' }),
    makeSeries({ id: 'sv2', title: 'Lighthouse Keepers' }),
  ];

  /** The Series tab and each series' detail, over whatever else the file serves. */
  beforeEach(() => {
    const movies = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      const detail = url.match(/\/api\/series\/([^/?]+)$/);
      if (detail) {
        const series = SERIES.find((candidate) => candidate.id === detail[1]);
        const payload: SeriesDetail | undefined = series && {
          series,
          seasons: [],
          next: null,
        };
        return Promise.resolve(
          payload ? okResponse(payload) : new Response(null, { status: 404 })
        );
      }
      if (url.includes('/api/series')) {
        const payload: SeriesHomePayload = {
          series: SERIES,
          episodeCount: 0,
          continueWatching: [],
        };
        return Promise.resolve(okResponse(payload));
      }
      if (movies === undefined) {
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      }
      return movies(input, init);
    });
  });

  /** What a parent does with a wheel: the body moves, and it says so. */
  function scrollTo(element: HTMLElement, top: number) {
    element.scrollTop = top;
    fireEvent.scroll(element);
  }

  /** The browse home's scrolling body: the one thing the header is followed by. */
  function homeBody() {
    return screen.getByRole('banner').nextElementSibling as HTMLElement;
  }

  it('renders the series itself when /series/:id is opened directly', async () => {
    renderApp('/series/sv1');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Harbor & Vine' })
    ).toBeDefined();
  });

  it('opens a series’ page from its poster on the Series tab', async () => {
    renderApp('/?tab=series');

    fireEvent.click(
      await screen.findByRole('button', { name: 'Lighthouse Keepers' })
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Lighthouse Keepers',
      })
    ).toBeDefined();
    expect(pathname()).toBe('/series/sv2');
  });

  it('lands back on the Series tab still filtered and still scrolled', async () => {
    renderApp('/?tab=series&sort=a-z');
    await screen.findByRole('heading', { name: 'All series' });
    scrollTo(homeBody(), 1240);

    fireEvent.click(screen.getByRole('button', { name: 'Harbor & Vine' }));
    await screen.findByRole('heading', { level: 1, name: 'Harbor & Vine' });
    await pressBack();

    await waitFor(() => expect(pathname()).toBe('/'));
    expect(search()).toBe('?tab=series&sort=a-z');
    await screen.findByRole('heading', { name: 'All series' });
    expect(homeBody().scrollTop).toBe(1240);
  });

  it('lands on the Series tab from a series opened by deep link', async () => {
    renderApp('/series/sv1');
    await screen.findByRole('heading', { level: 1, name: 'Harbor & Vine' });

    await pressBack();

    await waitFor(() => expect(pathname()).toBe('/'));
    expect(search()).toBe('?tab=series');
    expect(
      await screen.findByRole('heading', { name: 'All series' })
    ).toBeDefined();
  });
});

/**
 * 22 — Series (TV), Phase 3 (issue #193): the season page. `/series/:id/season/:n`
 * is a route of its own; a Season card on the series page opens it, and its
 * _Back to series_ steps back to that page.
 */
describe('App — the season page', () => {
  const DETAIL: SeriesDetail = {
    series: {
      id: 'sv1',
      tmdbId: null,
      title: 'Harbor & Vine',
      year: 2019,
      endYear: 2023,
      synopsis: null,
      creator: 'Mara Quinn',
      cast: [],
      rating: 8,
      isFavorite: false,
      posterPath: null,
      backdropPath: null,
      genres: [],
      watched: false,
      createdAt: '2026-09-23T00:00:00.000Z',
      updatedAt: '2026-09-23T00:00:00.000Z',
    },
    seasons: [1, 2].map((number) => {
      const episode = {
        id: `s${number}e1`,
        seriesId: 'sv1',
        season: number,
        number: 1,
        title: null,
        airDate: null,
        runtimeMinutes: null,
        watched: false,
        resumePositionSeconds: 0,
        status: 'unwatched' as const,
        videoPath: `harbor-2019/season-0${number}/e1.mp4`,
        subtitles: [],
        lastWatchedAt: null,
      };
      return { number, episodes: [episode], next: episode };
    }),
    next: null,
  };

  beforeEach(() => {
    const movies = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url === '/api/series/sv1') {
        return Promise.resolve(okResponse(DETAIL));
      }
      if (movies === undefined) {
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      }
      return movies(input, init);
    });
  });

  it('renders the season itself when /series/:id/season/:n is opened directly', async () => {
    renderApp('/series/sv1/season/2');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Season 2' })
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /^S02E01\b/ })).toBeDefined();
  });

  it('opens a season from its card on the series page, and steps back to it', async () => {
    renderApp('/series/sv1');
    await screen.findByRole('heading', { level: 1, name: 'Harbor & Vine' });

    fireEvent.click(screen.getByRole('button', { name: /\bSeason 2\b/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Season 2' })
    ).toBeDefined();
    expect(pathname()).toBe('/series/sv1/season/2');

    fireEvent.click(screen.getByRole('button', { name: 'Back to series' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Harbor & Vine' })
    ).toBeDefined();
    expect(pathname()).toBe('/series/sv1');
  });
});
