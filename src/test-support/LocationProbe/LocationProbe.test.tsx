import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  MemoryRouter,
  useNavigate,
  type MemoryRouterProps,
} from 'react-router-dom';

import { LocationProbe } from './LocationProbe';

/**
 * The probe is the one thing under test here, so nothing else is on screen
 * except a control that moves the router — the only way to show that the probe
 * reports where the router *is* rather than where it started.
 */
function GoTo({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      Go to {to}
    </button>
  );
}

function renderProbe(
  probe: React.ReactNode,
  initialEntries: MemoryRouterProps['initialEntries'] = ['/']
) {
  return render(
    <MemoryRouter
      initialEntries={initialEntries}
      initialIndex={(initialEntries?.length ?? 1) - 1}
    >
      {probe}
      <GoTo to="/genre/action?sort=year" />
    </MemoryRouter>
  );
}

describe('LocationProbe — what it reports', () => {
  it('reports the path the router is on', () => {
    renderProbe(<LocationProbe />, ['/movie/12']);

    expect(screen.getByTestId('pathname').textContent).toBe('/movie/12');
  });

  it('reports the query string the router is on', () => {
    renderProbe(<LocationProbe />, ['/?q=lighthouse']);

    expect(screen.getByTestId('search').textContent).toBe('?q=lighthouse');
  });

  it('reports an empty query string as empty rather than as absent', () => {
    renderProbe(<LocationProbe />, ['/movie/12']);

    expect(screen.getByTestId('search').textContent).toBe('');
  });

  it('reports path and query together as one URL', () => {
    renderProbe(<LocationProbe />, ['/genre/action?sort=year']);

    expect(screen.getByTestId('url').textContent).toBe(
      '/genre/action?sort=year'
    );
  });

  it('reports the new location after the router has moved', () => {
    renderProbe(<LocationProbe />, ['/']);

    fireEvent.click(
      screen.getByRole('button', { name: 'Go to /genre/action?sort=year' })
    );

    expect(screen.getByTestId('pathname').textContent).toBe('/genre/action');
    expect(screen.getByTestId('search').textContent).toBe('?sort=year');
    expect(screen.getByTestId('url').textContent).toBe(
      '/genre/action?sort=year'
    );
  });
});

describe('LocationProbe — the Back control', () => {
  it('offers no Back control by default, so a screen owns that name alone', () => {
    renderProbe(<LocationProbe />, ['/one', '/two']);

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('returns to the previous entry when asked for a Back control', () => {
    renderProbe(<LocationProbe withBack />, ['/one', '/two']);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByTestId('pathname').textContent).toBe('/one');
  });

  it('reports where Back landed, query string and all', () => {
    renderProbe(<LocationProbe withBack />, ['/?q=lighthouse', '/movie/12']);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByTestId('url').textContent).toBe('/?q=lighthouse');
  });
});
