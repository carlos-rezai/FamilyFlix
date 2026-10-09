import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { DetailBackdrop } from '@/components';
import { createTheme, theme } from '@/styles/theme';
import { gradientFromId } from '@/utils';

/**
 * 34 — Backdrop veil (issue #289): the **Detail backdrop**, the one art layer
 * both detail pages draw. Its root is `aria-hidden`, pinned to the top of the
 * page's scroller and a full viewport tall; inside it the **Backdrop** paints
 * over its **Gradient fallback**, under the **Backdrop veil** — a darkening
 * gradient over the theme's `accentSoft`.
 *
 * Read through `getComputedStyle`, as the browser resolves it, never through a
 * class name. jsdom does no layout, so whether it actually stays put while the
 * page scrolls is checked in the running app.
 */

const STOPS = gradientFromId('m1');
const BACKDROP_URL = '/api/images/northwind/backdrop.jpg';

function drawBackdrop(
  url: string | null = BACKDROP_URL,
  withTheme: ReturnType<typeof createTheme> = theme
): HTMLElement {
  const { container } = render(
    <ThemeProvider theme={withTheme}>
      <DetailBackdrop url={url} g1={STOPS.g1} g2={STOPS.g2} />
    </ThemeProvider>
  );
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) {
    throw new Error('DetailBackdrop drew nothing');
  }
  return root;
}

/** Every background the root and its descendants paint, as resolved. */
function backgrounds(root: HTMLElement): string[] {
  return [root, ...Array.from(root.querySelectorAll('*'))].map((el) => {
    const style = window.getComputedStyle(el);
    return [style.background, style.backgroundImage, style.backgroundColor]
      .filter(Boolean)
      .join(' | ');
  });
}

/** The Artwork's resolved image: the one layer drawing the 155° gradient. */
function artworkImage(root: HTMLElement): string {
  const art = [root, ...Array.from(root.querySelectorAll('*'))]
    .map((el) => window.getComputedStyle(el).backgroundImage)
    .find((image) => image.includes(STOPS.g1));
  if (art === undefined) {
    throw new Error('No Artwork drawing the Gradient fallback');
  }
  return art;
}

/** An accent's 14% alpha, as `accentScale` spells `accentSoft`. */
function soft(r: number, g: number, b: number): RegExp {
  return new RegExp(`rgba\(${r},\s*${g},\s*${b},\s*0?\.14\)`);
}

describe('DetailBackdrop — the art layer', () => {
  it('is hidden from assistive technology, pinned to the top, a full viewport tall', () => {
    const root = drawBackdrop();

    expect(root.getAttribute('aria-hidden')).toBe('true');
    const style = window.getComputedStyle(root);
    expect(style.position).toBe('sticky');
    expect(style.top).toBe('0px');
    expect(style.height).toBe('100vh');
  });

  it('paints the backdrop over the Gradient fallback', () => {
    const image = artworkImage(drawBackdrop(BACKDROP_URL));

    expect(image).toContain(BACKDROP_URL);
    expect(image).toContain('linear-gradient');
    expect(image.indexOf(BACKDROP_URL)).toBeLessThan(
      image.indexOf('linear-gradient')
    );
  });

  it('paints the Gradient fallback alone when there is no backdrop', () => {
    const image = artworkImage(drawBackdrop(null));

    expect(image).toContain('linear-gradient');
    expect(image).not.toContain('url(');
  });
});

describe('DetailBackdrop — the Backdrop veil', () => {
  it('washes the art in the theme’s own accentSoft, not the default accent’s', () => {
    const painted = backgrounds(
      drawBackdrop(BACKDROP_URL, createTheme('#3a7bd5'))
    ).join('\n');

    // #3a7bd5 → rgb(58, 123, 213); the default #d97a4e → rgb(217, 122, 78).
    expect(painted).toMatch(soft(58, 123, 213));
    expect(painted).not.toMatch(soft(217, 122, 78));
  });
});
