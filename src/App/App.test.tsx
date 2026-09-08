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
import type { GenrePayload, HomePayload, HomeRow, Movie } from '@/types';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { stubMediaElement } from '@/test-support/stubMediaElement/stubMediaElement';
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

function currentPath() {
  return screen.getByTestId('pathname').textContent;
}

/** The query string the router currently carries, `?movie=a1` and the like. */
function currentSearch() {
  return screen.getByTestId('search').textContent;
}

/** The card for one movie — clicking its title bubbles to the card itself. */
function cardFor(title: string) {
  return screen.getAllByText(title)[0];
}

describe('App — routing the browse home to its destinations', () => {
  it('renders the browse home at /', async () => {
    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'Action' })
    ).toBeDefined();
    expect(currentPath()).toBe('/');
  });

  it('navigates to /movie/:id when a poster card is clicked, and that movie’s page renders', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });

    fireEvent.click(cardFor('Northwind'));

    expect(currentPath()).toBe('/movie/a1');
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

    expect(currentPath()).toBe('/genre/Action');
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

    expect(currentPath()).toBe('/genre/Science%20Fiction');
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

    expect(currentPath()).toBe('/');
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

    expect(currentPath()).toBe('/');
    expect(screen.queryByRole('heading', { name: /a1/ })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Action' })).toBeDefined();
  });
});

/**
 * The movie page's two navigating actions. `/add` still lands on a registered
 * placeholder — the device that made `/movie/:id` itself an honest link two
 * features ago — and `/movie/:id/play` is the first of the two to have the real
 * screen behind it, arriving without a single link changing, which was the whole
 * point of registering the URL early.
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

  it('renders the add-movie placeholder when /add is opened directly', async () => {
    renderApp('/add');

    expect(await screen.findByRole('heading', { name: /add/i })).toBeDefined();
  });

  it('sends Play to the player route for the movie being looked at', async () => {
    const { container } = renderApp('/movie/a1');
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(currentPath()).toBe('/movie/a1/play');
    // Pressing Play on Northwind plays Northwind: the button, the URL and the
    // stream all name the same film.
    await waitFor(() =>
      expect(container.querySelector('video')).not.toBeNull()
    );
    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/api/movies/a1/stream'
    );
  });

  it('sends Edit details to the add screen carrying the movie id', async () => {
    renderApp('/movie/a1');
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });

    fireEvent.click(screen.getByRole('button', { name: /more options/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /edit details/i }));

    expect(currentPath()).toBe('/add');
    expect(currentSearch()).toBe('?movie=a1');
    expect(await screen.findByRole('heading', { name: /add/i })).toBeDefined();
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

    expect(currentPath()).toBe('/');
    await screen.findByRole('heading', { name: 'Action' });
    expect(homeBody().scrollTop).toBe(1240);

    // Being *sent* to the home screen is a fresh visit — a new history entry
    // rather than the scrolled one — so it starts at the top. The vehicle is a
    // finished save, because that is the only deliberate trip home the app has:
    // this used to press the header logo on the Settings screen, and the real
    // Settings screen (issue #98) has no app header for it to press.
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('heading', { name: /settings/i });
    fireEvent.click(screen.getByRole('button', { name: /add a movie/i }));
    fireEvent.change(await screen.findByRole('textbox', { name: /title/i }), {
      target: { value: 'Saved Film' },
    });
    await pickVideo();
    fireEvent.click(screen.getByRole('button', { name: /add to library/i }));

    await waitFor(() => expect(currentPath()).toBe('/'));
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

    expect(currentPath()).toBe('/');
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

    expect(currentPath()).toBe('/genre/Action');
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

    expect(currentPath()).toBe('/movie/a1');
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

    expect(currentPath()).toBe('/genre/Action');
    expect(currentSearch()).toBe('?q=north&sort=a-z');
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

    expect(currentPath()).toBe('/genre/Science%20Fiction');
    expect(currentSearch()).toBe('?sort=a-z');
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

    expect(currentPath()).toBe('/genre/Science%20Fiction');
    expect(currentSearch()).toBe('');
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
    expect(currentPath()).toBe('/settings');
    await screen.findByRole('heading', { name: 'Settings' });

    // And ＋ Add a movie is the only door from there to the form.
    fireEvent.click(screen.getByRole('button', { name: /add a movie/i }));
    expect(currentPath()).toBe('/add');

    const title = await screen.findByRole('textbox', { name: /title/i });
    fireEvent.change(title, { target: { value: 'Rear Window' } });
    fireEvent.change(screen.getByRole('textbox', { name: /year/i }), {
      target: { value: '1954' },
    });
    await pickVideo();
    fireEvent.click(screen.getByRole('button', { name: /add to library/i }));

    // Landing on the browse home is where the maintainer sees it worked, and
    // the row is there without a reload because the screen loads on arrival.
    await waitFor(() => expect(currentPath()).toBe('/'));
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
    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(currentPath()).toBe('/');
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
    fireEvent.click(screen.getByRole('button', { name: /add a movie/i }));

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

    await waitFor(() => expect(currentPath()).toBe('/'));
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

    await waitFor(() => expect(currentPath()).toBe('/'));

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

    await waitFor(() => expect(currentPath()).toBe('/'));
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

    await waitFor(() => expect(currentPath()).toBe('/'));

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

    await waitFor(() => expect(currentPath()).toBe('/'));
    await screen.findByRole('region', { name: 'Thriller' });

    // Unchanged from Phase 1, and still not a bug: every section of the home is
    // a genre row, the resume queue or the favorites shelf, so an unfiled film
    // is in the library and on none of them.
    expect(screen.queryAllByRole('region')).toHaveLength(1);
    expect(cardInRow('Thriller', 'Rear Window')).toBeNull();
  });
});
