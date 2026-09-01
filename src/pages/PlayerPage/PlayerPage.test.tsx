import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import PlayerPage from './PlayerPage';
import { theme } from '@/styles/theme';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { stubMediaElement } from '@/test-support/stubMediaElement/stubMediaElement';

/**
 * 10 — Video player, Phase 2: "direct play" (issue #84), still standing in
 * Phase 3 (issue #85).
 *
 * The page is composition only: read the `:id` the route matched and hand it to
 * `Player`. That one read is the whole of what is asserted here, and it is
 * asserted the only way it can be seen from outside — the movie in the URL is
 * the movie in the stream the element is pointed at. A page that dropped the
 * parameter, or carried the wrong one, would render a working player for the
 * wrong film.
 *
 * What Phase 3 adds is scaffolding rather than assertions: the player now
 * fetches (the movie record and the **Playback read**) and drives a media
 * element, so the wire and the element are both stubbed to keep this file about
 * the parameter and nothing else.
 */
function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

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
