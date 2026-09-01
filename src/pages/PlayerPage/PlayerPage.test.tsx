import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import PlayerPage from './PlayerPage';
import { theme } from '@/styles/theme';

/**
 * 10 — Video player, Phase 2: "direct play" (issue #84).
 *
 * The page replaces the placeholder that has stood behind `/movie/:id/play`
 * since the movie detail page shipped. It is composition only: read the `:id`
 * the route matched and hand it to `Player`.
 *
 * That one read is the whole of what is asserted here, and it is asserted the
 * only way it can be seen from outside — the movie in the URL is the movie in
 * the stream the element is pointed at. A page that dropped the parameter, or
 * carried the wrong one, would render a working player for the wrong film.
 */
function renderAt(entry: string) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/movie/:id/play" element={<PlayerPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('PlayerPage', () => {
  it('renders a player for the movie the route matched', () => {
    const { container } = renderAt('/movie/a1/play');

    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/api/movies/a1/stream'
    );
  });

  it('follows the id, so a second film is not the first one over again', () => {
    const { container } = renderAt('/movie/reel-4/play');

    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/api/movies/reel-4/stream'
    );
  });
});
