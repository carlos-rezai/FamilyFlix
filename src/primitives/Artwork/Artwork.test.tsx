import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { Artwork } from '@/primitives';
import { gradientFromId } from '@/utils';
import { theme } from '@/styles/theme';

const STOPS = gradientFromId('m1');
const POSTER_URL = '/api/images/northwind-poster.jpg';

interface ArtworkCall {
  url?: string | null;
  poster?: boolean;
  stops?: { g1: string; g2: string };
}

/** Draws one Artwork in a frame and hands back the element it drew. */
function drawArtwork({ url, poster, stops = STOPS }: ArtworkCall = {}) {
  const { container } = render(
    <ThemeProvider theme={theme}>
      <div data-testid="frame">
        <Artwork url={url} poster={poster} g1={stops.g1} g2={stops.g2} />
      </div>
    </ThemeProvider>
  );

  const art = within(container).getByTestId('frame').firstElementChild;
  if (art === null) {
    throw new Error('Artwork drew nothing');
  }
  return art;
}

/** What the browser would actually paint, rather than which class it wore. */
function renderArtwork(url?: string | null, stops = STOPS) {
  return window.getComputedStyle(drawArtwork({ url, stops })).backgroundImage;
}

describe('Artwork', () => {
  it('paints the artwork it is given over the gradient, so a file that fails to load shows the gradient', () => {
    const background = renderArtwork(POSTER_URL);

    expect(background).toContain(POSTER_URL);
    expect(background).toContain('linear-gradient');
    // Background layers paint first-on-top: the url must come before the
    // gradient for the gradient to be what shows through a broken image.
    expect(background.indexOf(POSTER_URL)).toBeLessThan(
      background.indexOf('linear-gradient')
    );
  });

  it('paints the gradient alone when there is no artwork', () => {
    const background = renderArtwork(null);

    expect(background).toContain('linear-gradient');
    expect(background).not.toContain('url(');
  });

  it('draws the stops it is given, so each movie keeps its own placeholder', () => {
    // Compared rather than matched against a colour literal: the browser is
    // free to normalise `hsl()` into `rgb()`, and what matters is that two
    // movies do not collapse onto one gradient.
    const northwind = renderArtwork(null, gradientFromId('northwind'));
    const ironclad = renderArtwork(null, gradientFromId('ironclad'));

    expect(northwind).not.toBe(ironclad);
  });

  it('treats an omitted url as the gradient fallback, not as a mistake', () => {
    const background = renderArtwork();

    expect(background).toContain('linear-gradient');
    expect(background).not.toContain('url(');
  });
});

describe('Artwork — the Default poster', () => {
  it('draws the Wordmark on a poster with no artwork', () => {
    drawArtwork({ url: null, poster: true });

    expect(screen.getByText('Family')).toBeTruthy();
    expect(screen.getByText('Flix')).toBeTruthy();
  });

  it('hides that Wordmark from the accessibility tree, so the caller’s name stands alone', () => {
    drawArtwork({ url: null, poster: true });

    expect(screen.getByText('Flix').closest('[aria-hidden="true"]')).not.toBe(
      null
    );
  });

  it('draws no Wordmark on a poster that has artwork', () => {
    drawArtwork({ url: POSTER_URL, poster: true });

    expect(screen.queryByText('Flix')).toBe(null);
    expect(screen.queryByText('Family')).toBe(null);
  });

  it('draws no Wordmark when the caller does not ask for a poster', () => {
    drawArtwork({ url: null });

    expect(screen.queryByText('Flix')).toBe(null);
    expect(screen.queryByText('Family')).toBe(null);
  });
});
