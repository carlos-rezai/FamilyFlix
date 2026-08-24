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
