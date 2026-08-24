import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
  type MemoryRouterProps,
} from 'react-router-dom';

import { useRestoredScroll } from './useRestoredScroll';
import { stubScrollMetrics } from '@/test-support/stubScrollMetrics/stubScrollMetrics';

stubScrollMetrics(6390);

/** What a parent does with a wheel: the container moves, and it says so. */
function scrollTo(element: HTMLElement, top: number) {
  element.scrollTop = top;
  fireEvent.scroll(element);
}

/**
 * A screen with an inner scroll container, which is the only thing the hook is
 * ever attached to. The name is on the element so a test can tell one screen's
 * container from another's after a navigation has replaced it.
 */
function Screen({ name }: { name: string }) {
  const container = useRestoredScroll<HTMLDivElement>();

  return (
    <div data-testid={name} ref={container}>
      {name}
    </div>
  );
}

/**
 * One wrapper per route, because React reconciles by position and type: two
 * routes rendering the same component would hand the second screen the first
 * one's DOM node, scroll offset and all, and a hook that did nothing would look
 * like it worked. Distinct types make each navigation a real unmount, as every
 * route change in the app is.
 */
function HomeScreen() {
  return <Screen name="home" />;
}

function MovieScreen() {
  return <Screen name="movie" />;
}

/** The app's navigation, reduced to the four moves a history test needs. */
function Nav() {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate('/')}>
        open home
      </button>
      <button type="button" onClick={() => navigate('/movie/m1')}>
        open movie
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        history step back
      </button>
      <button type="button" onClick={() => navigate(1)}>
        history step forward
      </button>
    </>
  );
}

function renderScreens(
  initialEntries: MemoryRouterProps['initialEntries'] = ['/'],
  initialIndex?: number
) {
  return render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <Nav />
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/movie/:id" element={<MovieScreen />} />
      </Routes>
    </MemoryRouter>
  );
}

const container = (name: string) => screen.getByTestId(name);
const click = (label: string) =>
  fireEvent.click(screen.getByRole('button', { name: label }));

const back = () => click('history step back');
const forward = () => click('history step forward');
const openMovie = () => click('open movie');
const openHome = () => click('open home');

describe('useRestoredScroll', () => {
  it('returns a container to where it was left when its history entry is revisited', () => {
    renderScreens();
    scrollTo(container('home'), 420);

    openMovie();
    back();

    expect(container('home').scrollTop).toBe(420);
  });

  it('restores where the container was left last, not where it was first seen', () => {
    renderScreens();
    scrollTo(container('home'), 420);
    scrollTo(container('home'), 1180);

    openMovie();
    back();

    expect(container('home').scrollTop).toBe(1180);
  });

  it('starts a screen at the top rather than inheriting the position of the one it replaced', () => {
    renderScreens();
    scrollTo(container('home'), 420);

    openMovie();

    expect(container('movie').scrollTop).toBe(0);
  });

  it('starts a fresh visit at the top even when an earlier entry for that path has a position', () => {
    renderScreens();
    scrollTo(container('home'), 420);
    openMovie();

    // Forward to `/` again — a new history entry, not the one that was scrolled.
    openHome();

    expect(container('home').scrollTop).toBe(0);
  });

  it('keeps a position per history entry, so two entries for the same path do not share one', () => {
    renderScreens();
    // Entry A at `/`, then `/movie/m1`, then a second entry B at `/`.
    scrollTo(container('home'), 420);
    openMovie();
    openHome();
    scrollTo(container('home'), 90);

    back();
    back();
    expect(container('home').scrollTop).toBe(420);

    forward();
    forward();
    expect(container('home').scrollTop).toBe(90);
  });
});
