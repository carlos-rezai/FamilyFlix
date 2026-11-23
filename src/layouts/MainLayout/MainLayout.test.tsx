import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';

import { MainLayout, type MainLayoutProps } from './MainLayout';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { stubScrollMetrics } from '@/test-support/stubScrollMetrics/stubScrollMetrics';
import { stubScrollTo } from '@/test-support/stubScrollTo/stubScrollTo';

stubScrollMetrics(6390);

function renderLayout(
  children: React.ReactNode,
  entry: string | string[] = '/',
  slots: Omit<Partial<MainLayoutProps>, 'children'> = {}
) {
  return render(
    <MemoryRouter initialEntries={[entry].flat()}>
      <ThemeProvider theme={theme}>
        <MainLayout {...slots}>{children}</MainLayout>
      </ThemeProvider>
      <LocationProbe />
    </MemoryRouter>
  );
}

/** The header's **Wordmark**: the banner's first element, never a control. */
const wordmark = () =>
  screen.getByRole('banner').firstElementChild as HTMLElement;
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

  it('draws the wordmark and offers the gear on every screen it wraps', () => {
    renderLayout(<p>the library goes here</p>);

    expect(wordmark().textContent).toBe('FamilyFlix');
    expect(gear()).toBeDefined();
  });

  it('draws the wordmark as no button', () => {
    renderLayout(<p>the library goes here</p>);

    expect(screen.queryByRole('button', { name: /familyflix/i })).toBeNull();
    expect(wordmark().closest('button')).toBeNull();
  });

  it('leaves the route where it was when the wordmark is pressed', () => {
    renderLayout(<p>the settings screen</p>, '/settings');

    fireEvent.click(wordmark());

    expect(pathname()).toBe('/settings');
  });

  it('navigates to settings when the gear is clicked', () => {
    renderLayout(<p>the library goes here</p>);

    fireEvent.click(gear());

    expect(pathname()).toBe('/settings');
  });

  it('labels the gear by the action it performs, not the glyph it draws', () => {
    renderLayout(<p>the library goes here</p>);

    expect(gear().getAttribute('aria-label')).toBe('Settings');
  });
});

/**
 * The prototype splits the header strip in two: the search bar sits on the first
 * line and the genre / rating / sort dropdowns in the **Header end**, pushed to
 * the right. One slot cannot reproduce that, so the chrome offers two, and learns
 * nothing about the library in the process. Both are structure: whatever a page
 * hands in, it renders.
 */

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

  it('puts headerStart before the Header end and headerEnd inside it', () => {
    renderLayout(<p>the library goes here</p>, '/', {
      headerStart: <p>the search bar</p>,
      headerEnd: <p>the dropdowns</p>,
    });

    const end = headerEnd();
    expect(comesBefore(screen.getByText('the search bar'), end)).toBe(true);
    expect(end.contains(screen.getByText('the search bar'))).toBe(false);
    expect(end.contains(screen.getByText('the dropdowns'))).toBe(true);
  });

  it('holds no spacer: the Header end is pushed right by its own margin', () => {
    // A spacer would cost the first line a gap of its own and wrap the Header
    // end about 24px early, at a width where the search could still shrink.
    renderLayout(<p>the library goes here</p>, '/', {
      headerStart: <p>the search bar</p>,
      headerEnd: <p>the dropdowns</p>,
    });

    const growers = Array.from(screen.getByRole('banner').children).filter(
      (child) => getComputedStyle(child).flexGrow === '1'
    );
    expect(growers).toEqual([]);
  });

  it('leaves the wordmark first and the gear last', () => {
    renderLayout(<p>the library goes here</p>, '/', {
      headerStart: <p>the search bar</p>,
      headerEnd: <p>the dropdowns</p>,
    });

    expect(comesBefore(wordmark(), screen.getByText('the search bar'))).toBe(
      true
    );
    expect(comesBefore(screen.getByText('the dropdowns'), gear())).toBe(true);
  });

  it('renders either slot alone', () => {
    renderLayout(<p>the library goes here</p>, '/', {
      headerEnd: <p>the dropdowns</p>,
    });

    expect(comesBefore(wordmark(), screen.getByText('the dropdowns'))).toBe(
      true
    );
    expect(headerEnd().contains(screen.getByText('the dropdowns'))).toBe(true);
  });

  it('renders the header it always had when neither slot is given', () => {
    // Every other page passes no slots and must be untouched by this. The
    // gear is the header's one control: the wordmark is no button.
    renderLayout(<p>the library goes here</p>);

    const header = screen.getByRole('banner');
    expect(within(header).getAllByRole('button')).toEqual([gear()]);
    expect(header.contains(headerEnd())).toBe(true);
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

/**
 * 19 — Back-to-top FAB, Phase 2: "the mount" (issue #167).
 *
 * The body is where the scrolling happens, so the chrome is what knows how far
 * it has gone — and the chrome is what mounts **Back-to-top**, handed the same
 * body `useRestoredScroll` attached. The layout holds no state for it and
 * gains no prop: the FAB's own suite proves the **Scroll threshold**; this one
 * proves whose body the control is riding.
 */

const fab = () => screen.queryByRole('button', { name: 'Back to top' });

/**
 * A home that is a history entry of its own. `MemoryRouter` keys its first
 * entry `default` on every render, and `useRestoredScroll` remembers where
 * that entry was left for as long as the module lives — which, after the
 * history test above, is 1240. Landing on `/` as the second entry gives the
 * body a key nothing has scrolled, so it starts at its top as the family's
 * first visit does.
 */
const FRESH_HOME = ['/settings', '/'];

describe('MainLayout — the back-to-top FAB over its body', () => {
  const scrolling = stubScrollTo();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mounts the FAB after its own body once that body is past the threshold, and not before', () => {
    renderLayout(<p>the library goes here</p>, FRESH_HOME);
    const body = scrollingBody();
    expect(fab()).toBeNull();

    scrollTo(body, 1240);

    const button = fab();
    expect(button).not.toBeNull();
    // Over the body, not inside it, and not in the header.
    expect(body.contains(button)).toBe(false);
    expect(screen.getByRole('banner').contains(button)).toBe(false);
    expect(body.parentElement?.contains(button)).toBe(true);
    expect(comesBefore(body, button as HTMLElement)).toBe(true);
  });

  it('asks its own body for the top on a press — never the document', () => {
    renderLayout(<p>the library goes here</p>, FRESH_HOME);
    const body = scrollingBody();
    const windowScrollTo = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined);
    scrollTo(body, 1240);

    fireEvent.click(fab() as HTMLElement);

    // One request, and it was the body's — not the document element's.
    expect(scrolling.requests()).toEqual([
      { element: body, options: { top: 0, behavior: 'smooth' } },
    ]);
    expect(windowScrollTo).not.toHaveBeenCalled();
  });
});

/**
 * 55, Intro animation, Phase 2 (issue #504): the header wordmark hides only
 * under a playing welcome. Outside a `WelcomeProvider`, `useWelcome` answers
 * `wordmarkHidden: false`, so the chrome mounted alone shows its wordmark.
 */
describe('MainLayout: the wordmark outside a welcome', () => {
  it('shows its wordmark when mounted alone', () => {
    renderLayout(<p>the library goes here</p>);

    expect(wordmark().textContent).toBe('FamilyFlix');
    expect(getComputedStyle(wordmark()).visibility).not.toBe('hidden');
  });
});

/**
 * 55, Header fit, Phase 4 (issue #697): the **Header end**. The `headerEnd`
 * slot and the Settings button are one unit, never split: they sit at the
 * right of the header's first line while it fits, else move whole to a second
 * line. jsdom does no layout, so the wrap itself is proved in the walk; these
 * tests hold the structure and the fit rule's own declarations.
 */

/** The box that holds the Settings button: the **Header end**. */
const headerEnd = () => gear().parentElement as HTMLElement;

describe('MainLayout: the Header end', () => {
  it('draws the Settings button beside the headerEnd slot, in one box of the header', () => {
    renderLayout(<p>the library goes here</p>, '/', {
      headerStart: <p>the search bar</p>,
      headerEnd: <p>the dropdowns</p>,
    });

    const banner = screen.getByRole('banner');
    const end = headerEnd();
    expect(end).not.toBe(banner);
    expect(end.parentElement).toBe(banner);
    expect(end.contains(screen.getByText('the dropdowns'))).toBe(true);
    expect(end.contains(screen.getByText('the search bar'))).toBe(false);
    expect(comesBefore(screen.getByText('the dropdowns'), gear())).toBe(true);
  });

  it('keeps the Settings button in the Header end when no headerEnd is given', () => {
    renderLayout(<p>the library goes here</p>);

    const end = headerEnd();
    expect(end).not.toBe(screen.getByRole('banner'));
    expect(end.parentElement).toBe(screen.getByRole('banner'));
  });

  it('holds the Header end whole: never shrunk, never wrapped inside, pushed right', () => {
    renderLayout(<p>the library goes here</p>, '/', {
      headerEnd: <p>the dropdowns</p>,
    });

    const style = getComputedStyle(headerEnd());
    expect(style.display).toBe('flex');
    expect(style.flexShrink).toBe('0');
    expect(style.flexWrap).toBe('nowrap');
    expect(style.marginLeft).toBe('auto');
    expect(style.gap).toBe(theme.space.s5);
  });

  it('wraps the header by content alone, 12px under the first line, with no media or container query', () => {
    renderLayout(<p>the library goes here</p>, '/', {
      headerEnd: <p>the dropdowns</p>,
    });

    const style = getComputedStyle(screen.getByRole('banner'));
    expect(style.flexWrap).toBe('wrap');
    expect(style.rowGap).toBe(theme.space.s3);

    const css = Array.from(document.querySelectorAll('style'))
      .map((tag) => tag.textContent ?? '')
      .join('\n');
    expect(css).not.toMatch(/@media|@container/);
  });
});
