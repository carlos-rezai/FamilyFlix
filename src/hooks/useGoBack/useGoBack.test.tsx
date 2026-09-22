import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  MemoryRouter,
  Route,
  Routes,
  type MemoryRouterProps,
} from 'react-router-dom';

import { useGoBack } from './useGoBack';
import {
  LocationProbe,
  navigationType,
} from '@/test-support/LocationProbe/LocationProbe';
import { shippingSourcesMatching } from '@/test-support/shippingSources/shippingSources';

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

/**
 * 20 — Back navigation, Phase 5: "the form in Import context" (issue #175).
 *
 * The initiative's closing claim, and the only one no single screen can make:
 * there is **one Back rule**, and this file holds it. Every screen reaches a
 * **History step** through this hook, so a second `navigate(-1)` anywhere in
 * shipping code is a second Back rule — the thing the initiative exists to
 * end — and a `from` in route state is the other way of building one, a screen
 * remembering where it came from instead of letting the router remember.
 *
 * Green by design on the day it was written: no shipping file has held either
 * since #171. It is a guard rather than a discovery — the pressure is on the
 * next screen, Series' `backFromSeason` among them, to arrive through the hook
 * rather than beside it.
 *
 * It reads source rather than pressing a button because that is what the claim
 * is about: not what any one screen does, but what no file contains. What a
 * screen does is its own suite's to press — each of the player's, Import's and
 * the form's leavings is asserted there as a `POP` or a `PUSH`.
 */
describe('useGoBack — the only Back rule in the app', () => {
  /** This hook's own file, the one place a history step is allowed to live. */
  const THE_HOOK = 'src/hooks/useGoBack/useGoBack.ts';

  /**
   * The shipping files under `src/` whose code matches — by path, so a failure
   * names them. Tests and `test-support/` are not shipping code: the probe's
   * own Back button and the suites' stand-ins for browser chrome are history
   * steps on purpose. Comments are not code either, so a docblock may say
   * `navigate(-1)` without failing a test about calls.
   */
  const filesMatching = (pattern: RegExp): string[] =>
    shippingSourcesMatching('src', pattern);

  it('is the only shipping file that steps back through history', () => {
    expect(filesMatching(/navigate\(-1\)/)).toEqual([THE_HOOK]);
  });

  it('leaves the router to remember where a screen came from', () => {
    // No `from` in location state, anywhere: the history stack already holds
    // it, and a screen carrying its own answer is a Back rule that disagrees
    // with the browser's.
    expect(filesMatching(/state:\s*\{[^}]*\bfrom\b/)).toEqual([]);
  });
});
