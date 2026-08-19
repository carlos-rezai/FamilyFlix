import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { MainLayout, type MainLayoutProps } from './MainLayout';
import { theme } from '@/styles/theme';

/**
 * jsdom does no layout: every element reports `scrollTop: 0` and drops writes to
 * it, so the body returning to a position could never be observed. This gives
 * each element a real, writable `scrollTop` and the browse home's measured
 * overflow (6390 over a 698 viewport, issue #28), so a build that checks whether
 * there is anything to scroll is not failed for checking.
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
    get: () => 6390,
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

/** Reports the router's current path, so a navigation can name the URL. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderLayout(
  children: React.ReactNode,
  entry = '/',
  slots: Omit<Partial<MainLayoutProps>, 'children'> = {}
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ThemeProvider theme={theme}>
        <MainLayout {...slots}>{children}</MainLayout>
      </ThemeProvider>
      <LocationProbe />
    </MemoryRouter>
  );
}

function currentPath() {
  return screen.getByTestId('location').textContent;
}

const logo = () => screen.getByRole('button', { name: /familyflix/i });
const gear = () => screen.getByRole('button', { name: 'Settings' });

describe('MainLayout', () => {
  it('renders the body it is handed, under the header', () => {
    renderLayout(<p>the library goes here</p>);

    const body = screen.getByText('the library goes here');
    expect(body).toBeDefined();

    // The chrome is above the body, not wrapped around it.
    const header = screen.getByRole('banner');
    expect(header.contains(body)).toBe(false);
    expect(
      header.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('offers the logo and the gear on every screen it wraps', () => {
    renderLayout(<p>the library goes here</p>);

    expect(logo()).toBeDefined();
    expect(gear()).toBeDefined();
  });

  it('navigates home when the logo is clicked', () => {
    renderLayout(<p>the settings screen</p>, '/settings');

    fireEvent.click(logo());

    expect(currentPath()).toBe('/');
  });

  it('navigates to settings when the gear is clicked', () => {
    renderLayout(<p>the library goes here</p>);

    fireEvent.click(gear());

    expect(currentPath()).toBe('/settings');
  });

  it('labels the gear by the action it performs, not the glyph it draws', () => {
    renderLayout(<p>the library goes here</p>);

    expect(gear().getAttribute('aria-label')).toBe('Settings');
  });
});

/**
 * The prototype splits the header strip in two: the search bar sits *before* the
 * flex spacer and the genre / rating / sort dropdowns *after* it. One slot cannot
 * reproduce that, so the chrome offers two — and learns nothing about the library
 * in the process. Both are structure: whatever a page hands in, it renders.
 */

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

describe('MainLayout — the header slots', () => {
  it('renders both slots in the header, not in the body', () => {
    renderLayout(<p>the library goes here</p>, '/', {
      headerStart: <p>the search bar</p>,
      headerEnd: <p>the dropdowns</p>,
    });

    const header = screen.getByRole('banner');
    expect(header.contains(screen.getByText('the search bar'))).toBe(true);
    expect(header.contains(screen.getByText('the dropdowns'))).toBe(true);
  });

  it('puts headerStart before the spacer and headerEnd after it', () => {
    renderLayout(<p>the library goes here</p>, '/', {
      headerStart: <p>the search bar</p>,
      headerEnd: <p>the dropdowns</p>,
    });

    const spacer = headerSpacer();
    expect(comesBefore(screen.getByText('the search bar'), spacer)).toBe(true);
    expect(comesBefore(spacer, screen.getByText('the dropdowns'))).toBe(true);
  });

  it('leaves the logo first and the gear last', () => {
    renderLayout(<p>the library goes here</p>, '/', {
      headerStart: <p>the search bar</p>,
      headerEnd: <p>the dropdowns</p>,
    });

    expect(comesBefore(logo(), screen.getByText('the search bar'))).toBe(true);
    expect(comesBefore(screen.getByText('the dropdowns'), gear())).toBe(true);
  });

  it('renders either slot alone', () => {
    renderLayout(<p>the library goes here</p>, '/', {
      headerEnd: <p>the dropdowns</p>,
    });

    const spacer = headerSpacer();
    expect(comesBefore(spacer, screen.getByText('the dropdowns'))).toBe(true);
  });

  it('renders the header it always had when neither slot is given', () => {
    // Every other page passes no slots and must be untouched by this.
    renderLayout(<p>the library goes here</p>);

    const header = screen.getByRole('banner');
    expect(within(header).getAllByRole('button')).toHaveLength(2);
    expect(headerSpacer()).toBeDefined();
  });
});

/**
 * The chrome is where the scrolling happens — the document never scrolls, the
 * body under the header does — so it is the chrome that has to remember where a
 * screen was left. Every page wrapped in this layout inherits that, which is why
 * the tests below drive it here rather than in any one feature.
 */

/** What a parent does with a wheel: the body moves, and it says so. */
function scrollTo(element: HTMLElement, top: number) {
  element.scrollTop = top;
  fireEvent.scroll(element);
}

/** The layout's scrolling body: the one thing the header is followed by. */
function scrollingBody() {
  return screen.getByRole('banner').nextElementSibling as HTMLElement;
}

/** The two moves a history test needs, from outside the layout under test. */
function Nav() {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate('/settings')}>
        open settings
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        history step back
      </button>
    </>
  );
}

/**
 * One page component per route, as the app has. React reconciles by position and
 * type, so two routes rendering `MainLayout` directly would hand the second
 * screen the first one's body element, scroll offset and all — a layout that
 * remembered nothing would look like it worked.
 */
function HomeScreen() {
  return (
    <MainLayout>
      <p>the library goes here</p>
    </MainLayout>
  );
}

function SettingsScreen() {
  return (
    <MainLayout>
      <p>the settings screen</p>
    </MainLayout>
  );
}

function renderWrappedScreens() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ThemeProvider theme={theme}>
        <Nav />
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const step = (label: string) =>
  fireEvent.click(screen.getByRole('button', { name: label }));

describe('MainLayout — returning to where the screen was left', () => {
  it('returns its scrolling body to where it was left when the entry is revisited', () => {
    renderWrappedScreens();
    scrollTo(scrollingBody(), 1240);

    step('open settings');
    // The screen that replaced it is a screen of its own, at its own top.
    expect(scrollingBody().scrollTop).toBe(0);

    step('history step back');

    expect(scrollingBody().scrollTop).toBe(1240);
  });
});
