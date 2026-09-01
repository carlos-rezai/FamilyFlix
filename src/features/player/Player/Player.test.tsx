import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { Player } from './Player';
import { theme } from '@/styles/theme';

/**
 * 10 — Video player, Phase 2: "direct play" (issue #84).
 *
 * Deliberately almost nothing: a bare `<video>` pointed at the stream route,
 * driven by the browser's own controls. Our chrome, the playback hook and every
 * piece of state arrive in the phases after this one — what this phase promises
 * is that bytes leave the disk and arrive in an element.
 *
 * So the assertions are about the element's source and nothing else. jsdom
 * neither fetches nor decodes video, and the phase does not ask it to: whether
 * the picture actually moves is checked by looking at the seeded app, which is
 * what the seed's fixture file exists for.
 */
function renderPlayer(movieId: string) {
  return render(
    <ThemeProvider theme={theme}>
      <Player movieId={movieId} />
    </ThemeProvider>
  );
}

describe('Player', () => {
  it('points a video element at the movie’s stream', () => {
    const { container } = renderPlayer('a1');

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('/api/movies/a1/stream');
  });

  it('carries the browser’s own controls, which are this phase’s transport', () => {
    // The one thing the family can drive a film with until `PlayerControls`
    // lands. An element with no controls in this phase is a picture nobody can
    // pause.
    const { container } = renderPlayer('a1');

    expect(container.querySelector('video')?.hasAttribute('controls')).toBe(
      true
    );
  });

  it('encodes an id that would otherwise change the URL’s shape', () => {
    // Ids are minted by the repository, so this is a guard rather than a case
    // the app produces today — the URL carries an id, and an id has to arrive
    // as one segment however it is spelled.
    const { container } = renderPlayer('a/b?c');

    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/api/movies/a%2Fb%3Fc/stream'
    );
  });
});
