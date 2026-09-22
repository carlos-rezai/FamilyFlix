import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  MemoryRouter,
  Route,
  Routes,
  type MemoryRouterProps,
} from 'react-router-dom';

import { useGoBack } from './useGoBack';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';

/**
 * A screen whose only control is the one this hook returns. Nothing about the
 * screen matters — the hook is the unit, and what it does is move the router.
 */
function Screen({ name }: { name: string }) {
  const goBack = useGoBack();

  return (
    <>
      <span>{name}</span>
      <button type="button" onClick={goBack}>
        Back
      </button>
    </>
  );
}

function renderAt(
  initialEntries: MemoryRouterProps['initialEntries'],
  initialIndex?: number
) {
  return render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <LocationProbe />
      <Routes>
        <Route path="/" element={<span>Browse home</span>} />
        <Route path="/genre/:name" element={<Screen name="Genre screen" />} />
        <Route path="/movie/:id" element={<Screen name="Movie screen" />} />
      </Routes>
    </MemoryRouter>
  );
}

const clickBack = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));

const pathname = () => screen.getByTestId('pathname').textContent;

describe('useGoBack', () => {
  it('steps back through history when there is history behind the screen', () => {
    // Arrived on a movie from a genre, which itself came from the home. One
    // step is one step: the genre, not the home at the bottom of the stack.
    renderAt(['/', '/genre/Drama', '/movie/m1'], 2);
    expect(pathname()).toBe('/movie/m1');

    clickBack();

    expect(pathname()).toBe('/genre/Drama');
  });

  it('navigates to the library when the location is the first entry of the session', () => {
    // Opened by deep link or reload: there is nothing behind this screen, so a
    // history step would leave the parent stranded where they asked to leave.
    renderAt(['/genre/Drama']);
    expect(pathname()).toBe('/genre/Drama');

    clickBack();

    expect(pathname()).toBe('/');
  });
});

/**
 * A screen that names its own Landing — the route the rule pushes when there is
 * nothing behind the screen to step onto. The player's is its movie page,
 * Import's is Settings; here it is whatever the test hands it.
 */
function LandingScreen({ landing }: { landing: string }) {
  const goBack = useGoBack(landing);

  return (
    <>
      <span>Movie screen</span>
      <button type="button" onClick={goBack}>
        Back
      </button>
    </>
  );
}

/**
 * `/movie/:id` is the screen with a Landing of its own. `/settings` is a screen
 * on the default rule, so pressing *its* Back is how a test asks whether the
 * landing left any history behind it.
 */
function renderWithLanding(
  landing: string,
  initialEntries: MemoryRouterProps['initialEntries'],
  initialIndex?: number
) {
  return render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <LocationProbe />
      <Routes>
        <Route path="/" element={<span>Browse home</span>} />
        <Route path="/genre/:name" element={<Screen name="Genre screen" />} />
        <Route path="/settings" element={<Screen name="Settings screen" />} />
        <Route
          path="/movie/:id"
          element={<LandingScreen landing={landing} />}
        />
      </Routes>
    </MemoryRouter>
  );
}

const navigationType = () => screen.getByTestId('navigationType').textContent;

describe('useGoBack — a screen that names its own Landing', () => {
  it('takes the screen to its own Landing when there is no history behind it', () => {
    // Deep-linked or reloaded: the library is the default, but this screen said
    // where it belongs instead, and that is where a Back must go.
    renderWithLanding('/settings', ['/movie/m1']);
    expect(pathname()).toBe('/movie/m1');

    clickBack();

    expect(pathname()).toBe('/settings');
  });

  it('pushes the Landing, so the screen it lands on has history behind it', () => {
    renderWithLanding('/settings', ['/movie/m1']);

    clickBack();

    // A push, not a replace: the landing is a new entry, so it is not the first
    // entry of the session and its own Back is not a dead button.
    expect(navigationType()).toBe('PUSH');
    clickBack();
    expect(pathname()).toBe('/movie/m1');
  });

  it('never reaches the Landing when there is history behind the screen', () => {
    // Arrived on the movie from a genre shelf: the step wins, and the shelf is
    // returned to as it was left — Settings is not involved at all.
    renderWithLanding('/settings', ['/', '/genre/Drama', '/movie/m1'], 2);

    clickBack();

    expect(pathname()).toBe('/genre/Drama');
    expect(navigationType()).toBe('POP');
  });
});
