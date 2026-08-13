import { describe, it, expect } from 'vitest';
import { render, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { Artwork } from '@/primitives';
import { gradientFromId } from '@/utils';
import { theme } from '@/styles/theme';

const STOPS = gradientFromId('m1');

/** What the browser would actually paint, rather than which class it wore. */
function renderArtwork(url?: string | null, stops = STOPS) {
  const { container } = render(
    <ThemeProvider theme={theme}>
      <div data-testid="frame">
        <Artwork url={url} g1={stops.g1} g2={stops.g2} />
      </div>
    </ThemeProvider>
  );

  const art = within(container).getByTestId('frame').firstElementChild;
  if (art === null) {
    throw new Error('Artwork drew nothing');
  }
  return window.getComputedStyle(art).backgroundImage;
}

describe('Artwork', () => {
  it('draws the artwork it is given', () => {
    const background = renderArtwork('/api/images/northwind-poster.jpg');

    expect(background).toContain('/api/images/northwind-poster.jpg');
    expect(background).not.toContain('linear-gradient');
  });

  it('draws the gradient fallback when there is no artwork', () => {
    const background = renderArtwork(null);

    expect(background).toContain('linear-gradient');
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
    // The Continue card has no image slot by design (design log 03) and passes
    // nothing at all — that has to be a first-class way to call this.
    const background = renderArtwork();

    expect(background).toContain('linear-gradient');
  });
});
