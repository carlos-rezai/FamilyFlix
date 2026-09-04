import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import PlayerPage from './PlayerPage';
import { theme } from '@/styles/theme';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { stubMediaElement } from '@/test-support/stubMediaElement/stubMediaElement';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        String(input).endsWith('/playback')
          ? okResponse({ path: 'direct', durationSeconds: 600 })
          : okResponse(makeMovie())
      )
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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
  stubMediaElement();

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
