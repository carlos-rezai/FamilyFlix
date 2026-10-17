import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { theme } from '@/styles/theme';
import type { Playable } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { stubFullscreen } from '@/test-support/stubFullscreen/stubFullscreen';
import { stubMediaElement } from '@/test-support/stubMediaElement/stubMediaElement';
import { PlayerScreen } from './PlayerScreen';

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

function screenFor(playable: Playable) {
  return (
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <PlayerScreen playable={playable} />
      </MemoryRouter>
    </ThemeProvider>
  );
}

async function pictureOn(
  container: HTMLElement,
  stream: string
): Promise<HTMLVideoElement> {
  return waitFor(() => {
    const video = container.querySelector('video');
    if (video === null || video.getAttribute('src') !== stream) {
      throw new Error(`no picture on ${stream}`);
    }
    return video;
  });
}

describe('PlayerScreen', () => {
  stubMediaElement();
  stubFullscreen();

  it('sends its own surface up, around the player rather than inside it', async () => {
    const { container } = render(screenFor({ kind: 'movie', id: 'a1' }));
    const video = await pictureOn(container, '/api/movies/a1/stream');

    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));

    await waitFor(() =>
      expect(document.fullscreenElement).toBe(container.firstElementChild)
    );
    expect(document.fullscreenElement?.contains(video)).toBe(true);
  });

  it('keeps the same surface when it is handed something else to play', async () => {
    const { container, rerender } = render(
      screenFor({ kind: 'movie', id: 'a1' })
    );
    const first = await pictureOn(container, '/api/movies/a1/stream');
    const surface = container.firstElementChild;

    rerender(screenFor({ kind: 'movie', id: 'a2' }));

    const second = await pictureOn(container, '/api/movies/a2/stream');
    expect(second).not.toBe(first);
    expect(container.firstElementChild).toBe(surface);
    expect(surface?.contains(second)).toBe(true);
  });
});
