import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  type MemoryRouterProps,
} from 'react-router-dom';

import MoviePage from './MoviePage';
import { theme } from '@/styles/theme';

function notFoundResponse(): Response {
  return {
    ok: false,
    status: 404,
    json: () => Promise.resolve({ error: 'Movie not found' }),
  } as unknown as Response;
}

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  // The movie is stubbed as absent throughout. What this file tests is the
  // page's own chrome — the Back pill — and `MovieDetail` already owns 876
  // lines testing the organism; a movie that loads would only add a second,
  // slower copy of that.
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockResolvedValue(notFoundResponse());
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * jsdom does no layout: every element reports `scrollTop: 0` and drops writes to
 * it, so this page returning to a position could never be observed. This gives
 * each element a real, writable `scrollTop` and a genuine overflow, so a build
 * that checks whether there is anything to scroll is not failed for checking.
 */
const scrollTops = new WeakMap<HTMLElement, number>();

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
    configurable: true,
    get(this: HTMLElement) {
      return scrollTops.get(this) ?? 0;
    },
    set(this: HTMLElement, value: number) {
      scrollTops.set(this, value);
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => 4200,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 698,
  });
});

afterEach(() => {
  // Own properties on HTMLElement.prototype shadowing jsdom's own accessors on
  // Element.prototype — deleting them restores the real ones.
  for (const prop of ['scrollTop', 'scrollHeight', 'clientHeight'] as const) {
    delete (HTMLElement.prototype as Partial<Record<typeof prop, number>>)[
      prop
    ];
  }
});

/** Reports where the router actually is, so Back is asserted by destination. */
function LocationProbe() {
  const location = useLocation();
  return <span data-testid="pathname">{location.pathname}</span>;
}

function renderAt(
  initialEntries: MemoryRouterProps['initialEntries'],
  initialIndex?: number
) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
        <LocationProbe />
        <Routes>
          <Route path="/" element={<span>Browse home</span>} />
          <Route path="/genre/:name" element={<span>Genre screen</span>} />
          <Route path="/movie/:id" element={<MoviePage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

const clickBack = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));

const pathname = () => screen.getByTestId('pathname').textContent;

describe('MoviePage — Back', () => {
  it('offers a Back control', async () => {
    renderAt(['/movie/m1']);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy()
    );
  });

  it('steps back through history rather than jumping to the library', async () => {
    // Arrived from a genre screen, which itself was reached from the home. A
    // parent halfway down that genre expects to land back on it — not at the
    // top of the browse home.
    renderAt(['/', '/genre/Drama', '/movie/m1'], 2);
    await waitFor(() => expect(pathname()).toBe('/movie/m1'));

    clickBack();

    await waitFor(() => expect(pathname()).toBe('/genre/Drama'));
  });

  it('goes to the library when the page was opened by deep link or reload', async () => {
    // The first entry of a session: there is nothing behind this page, so a
    // history step would leave the parent stranded on the screen they just
    // asked to leave.
    renderAt(['/movie/m1']);
    await waitFor(() => expect(pathname()).toBe('/movie/m1'));

    clickBack();

    await waitFor(() => expect(pathname()).toBe('/'));
  });
});

/**
 * This page does not use `MainLayout` — its chrome floats over artwork, so it
 * owns its scroll container outright. It therefore cannot inherit the layout's
 * restoration and wires the same hook itself.
 */

/** What a parent does with a wheel: the container moves, and it says so. */
function scrollTo(element: HTMLElement, top: number) {
  element.scrollTop = top;
  fireEvent.scroll(element);
}

/** This page's scroll container: the element the Back pill sits inside. */
function scroller() {
  return screen.getByRole('button', { name: 'Back' })
    .parentElement as HTMLElement;
}

/** The two moves a history test needs, from outside the page under test. */
function Nav() {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate('/movie/m1/play')}>
        open player
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        history step back
      </button>
    </>
  );
}

function renderWithHistory() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/', '/movie/m1']} initialIndex={1}>
        <LocationProbe />
        <Nav />
        <Routes>
          <Route path="/" element={<span>Browse home</span>} />
          <Route path="/movie/:id" element={<MoviePage />} />
          <Route path="/movie/:id/play" element={<span>Player screen</span>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

const step = (label: string) =>
  fireEvent.click(screen.getByRole('button', { name: label }));

describe('MoviePage — returning to where the screen was left', () => {
  it('returns its scroll container to where it was left when the entry is revisited', async () => {
    renderWithHistory();
    await waitFor(() => expect(pathname()).toBe('/movie/m1'));
    scrollTo(scroller(), 640);

    step('open player');
    await waitFor(() => expect(pathname()).toBe('/movie/m1/play'));
    step('history step back');

    await waitFor(() => expect(pathname()).toBe('/movie/m1'));
    expect(scroller().scrollTop).toBe(640);
  });
});
