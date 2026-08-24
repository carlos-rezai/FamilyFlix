import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';

import { MainLayout, type MainLayoutProps } from './MainLayout';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { headerSpacer } from '@/test-support/headerSpacer/headerSpacer';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';
import { stubScrollMetrics } from '@/test-support/stubScrollMetrics/stubScrollMetrics';

stubScrollMetrics(6390);

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
  return screen.getByTestId('pathname').textContent;
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
