import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
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

  /**
   * The element the film plays in, once it is there.
   *
   * Waited on rather than taken from the first render: issue #95 put the
   * picture behind the **Playback read** having settled, because a film with no
   * file behind it and one nothing can decode must never be pointed at the
   * stream. The page still passes the route's id straight down — that is what
   * these two are about — it just arrives a tick later.
   */
  async function stream(container: HTMLElement): Promise<string | null> {
    return waitFor(() => {
      const video = container.querySelector('video');
      if (video === null) {
        throw new Error('The player drew no picture');
      }
      return video.getAttribute('src');
    });
  }

  it('renders a player for the movie the route matched', async () => {
    const { container } = renderAt('/movie/a1/play');

    expect(await stream(container)).toBe('/api/movies/a1/stream');
  });

  it('follows the id, so a second film is not the first one over again', async () => {
    const { container } = renderAt('/movie/reel-4/play');

    expect(await stream(container)).toBe('/api/movies/reel-4/stream');
  });
});
