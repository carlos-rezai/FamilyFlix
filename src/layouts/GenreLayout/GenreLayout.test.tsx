import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  type MemoryRouterProps,
} from 'react-router-dom';

import { GenreLayout, type GenreLayoutProps } from './GenreLayout';
import { theme } from '@/styles/theme';

/**
 * jsdom does no layout: every element reports `scrollTop: 0` and drops writes to
 * it, so the body returning to a position could never be observed. This gives
 * each element a real, writable `scrollTop` and a genuine overflow — a 214-card
 * shelf is far taller than the window — so a build that checks whether there is
 * anything to scroll is not failed for checking.
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
    get: () => 9400,
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

function renderLayout(
  children: React.ReactNode,
  slots: Omit<Partial<GenreLayoutProps>, 'children'> = {},
  initialEntries: MemoryRouterProps['initialEntries'] = ['/genre/Action'],
  initialIndex?: number
) {
  return render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <ThemeProvider theme={theme}>
        <GenreLayout {...slots}>{children}</GenreLayout>
      </ThemeProvider>
      <LocationProbe />
    </MemoryRouter>
  );
}

const pathname = () => screen.getByTestId('pathname').textContent;

const back = () => screen.getByRole('button', { name: 'Back' });

/**
 * The header's flex spacer — the one child that grows to split the strip.
 *
 * Throws when the header has lost it, rather than handing back nothing for the
 * caller to assert around: a missing spacer is the failure, and it reads better
 * as one sentence here than as three tests going quiet about where their
 * elements sit relative to something that isn't there.
 */
function headerSpacer(): Element {
  const children = Array.from(screen.getByRole('banner').children);
  const spacer = children.find(
    (child) => getComputedStyle(child).flexGrow === '1'
  );
  if (!spacer) {
    throw new Error('The header has no flex spacer to split the strip.');
  }
  return spacer;
}

/** Does `earlier` come before `later` in the document? */
function comesBefore(earlier: Element, later: Element) {
  return Boolean(
    earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING
  );
}

/** The layout's scrolling body: the one thing the header is followed by. */
function scrollingBody() {
  return screen.getByRole('banner').nextElementSibling as HTMLElement;
}

describe('GenreLayout', () => {
  it('renders the body it is handed, under the header', () => {
    renderLayout(<p>the genre grid goes here</p>);

    const body = screen.getByText('the genre grid goes here');

    // The chrome is above the body, not wrapped around it.
    const header = screen.getByRole('banner');
    expect(header.contains(body)).toBe(false);
    expect(comesBefore(header, body)).toBe(true);
  });

  it('renders both slots in the header, not in the body', () => {
    renderLayout(<p>the genre grid goes here</p>, {
      heading: <p>Action, 214 titles</p>,
      headerEnd: <p>the search box and the sort pill</p>,
    });

    const header = screen.getByRole('banner');
    expect(header.contains(screen.getByText('Action, 214 titles'))).toBe(true);
    expect(
      header.contains(screen.getByText('the search box and the sort pill'))
    ).toBe(true);
  });

  it('puts the heading before the spacer and headerEnd after it', () => {
    renderLayout(<p>the genre grid goes here</p>, {
      heading: <p>Action, 214 titles</p>,
      headerEnd: <p>the search box and the sort pill</p>,
    });

    const spacer = headerSpacer();
    expect(comesBefore(screen.getByText('Action, 214 titles'), spacer)).toBe(
      true
    );
    expect(
      comesBefore(spacer, screen.getByText('the search box and the sort pill'))
    ).toBe(true);
  });

  it('leaves Back first, before whatever the heading is', () => {
    renderLayout(<p>the genre grid goes here</p>, {
      heading: <p>Action, 214 titles</p>,
    });

    expect(comesBefore(back(), screen.getByText('Action, 214 titles'))).toBe(
      true
    );
  });

  it('renders either slot alone', () => {
    renderLayout(<p>the genre grid goes here</p>, {
      headerEnd: <p>the search box and the sort pill</p>,
    });

    const spacer = headerSpacer();
    expect(
      comesBefore(spacer, screen.getByText('the search box and the sort pill'))
    ).toBe(true);
    expect(screen.getByText('the genre grid goes here')).toBeDefined();
  });

  it('renders its body unchanged when neither slot is given', () => {
    renderLayout(<p>the genre grid goes here</p>);

    expect(screen.getByText('the genre grid goes here')).toBeDefined();
    expect(headerSpacer()).toBeDefined();
  });

  it('offers Back and nothing else, because this chrome has no logo and no gear', () => {
    // A second layout rather than a `MainLayout` variant: the app-wide
    // navigation deliberately does not follow a screen whose heading is
    // content its own body loaded.
    renderLayout(<p>the genre grid goes here</p>, {
      heading: <p>Action, 214 titles</p>,
      headerEnd: <p>the search box and the sort pill</p>,
    });

    const controls = within(screen.getByRole('banner')).getAllByRole('button');
    expect(controls).toHaveLength(1);
    expect(controls[0]).toBe(back());
  });
});

describe('GenreLayout — Back', () => {
  it('offers a Back control reachable by its accessible name', () => {
    renderLayout(<p>the genre grid goes here</p>);

    expect(back()).toBeDefined();
  });

  it('steps back through history rather than jumping to the library', () => {
    // Arrived on the genre from the browse home, which the parent had already
    // filtered and scrolled. Back is a step back onto it, not a fresh `/`.
    renderLayout(
      <p>the genre grid goes here</p>,
      {},
      ['/', '/genre/Action'],
      1
    );
    expect(pathname()).toBe('/genre/Action');

    fireEvent.click(back());

    expect(pathname()).toBe('/');
  });
});

/**
 * The header stays reachable down a 214-card shelf, which it can only do if the
 * grid is what overflows. That also makes the chrome — not any one screen — the
 * thing that remembers where the shelf was left.
 */
describe('GenreLayout — the body is what scrolls', () => {
  it('keeps the header outside the element that overflows', () => {
    renderLayout(<p>the genre grid goes here</p>, {
      heading: <p>Action, 214 titles</p>,
    });

    const body = scrollingBody();
    expect(body.contains(screen.getByText('the genre grid goes here'))).toBe(
      true
    );
    expect(body.contains(screen.getByRole('banner'))).toBe(false);
    expect(['auto', 'scroll']).toContain(getComputedStyle(body).overflowY);
  });
});

/** What a parent does with a wheel: the body moves, and it says so. */
function scrollTo(element: HTMLElement, top: number) {
  element.scrollTop = top;
  fireEvent.scroll(element);
}

/** The two moves a history test needs, from outside the layout under test. */
function Nav() {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate('/movie/m1')}>
        open movie
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        history step back
      </button>
    </>
  );
}

/**
 * One page component per route, as the app has. React reconciles by position and
 * type, so two routes rendering `GenreLayout` directly would hand the second
 * screen the first one's body element, scroll offset and all — a layout that
 * remembered nothing would look like it worked.
 */
function GenreScreen() {
  return (
    <GenreLayout heading={<p>Action, 214 titles</p>}>
      <p>the genre grid goes here</p>
    </GenreLayout>
  );
}

function MovieScreen() {
  return (
    <GenreLayout heading={<p>The Fugitive</p>}>
      <p>the movie screen</p>
    </GenreLayout>
  );
}

function renderWrappedScreens() {
  return render(
    <MemoryRouter initialEntries={['/genre/Action']}>
      <ThemeProvider theme={theme}>
        <Nav />
        <Routes>
          <Route path="/genre/:name" element={<GenreScreen />} />
          <Route path="/movie/:id" element={<MovieScreen />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const step = (label: string) =>
  fireEvent.click(screen.getByRole('button', { name: label }));

describe('GenreLayout — returning to where the shelf was left', () => {
  it('returns its scrolling body to where it was left when the entry is revisited', () => {
    renderWrappedScreens();
    scrollTo(scrollingBody(), 3120);

    step('open movie');
    // The screen that replaced it is a screen of its own, at its own top.
    expect(scrollingBody().scrollTop).toBe(0);

    step('history step back');

    expect(scrollingBody().scrollTop).toBe(3120);
  });
});
