import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ServerStyleSheet, ThemeProvider } from 'styled-components';

import { PlayerNotice } from '@/features/player/PlayerNotice/PlayerNotice';
import { shippingSourcesMatching } from '@/test-support/shippingSources/shippingSources';

import { GlobalStyle } from './GlobalStyle';
import { theme } from './theme';

/**
 * 21 — Motion & interaction states, Phase 1 (issue #181).
 *
 * **Reduced motion** is ported verbatim from `tokens.css` into the global
 * stylesheet, once: under `prefers-reduced-motion: reduce`, every element and
 * pseudo-element has its animation and transition durations collapsed and its
 * animations run once. That puts every motion already shipped under the rule
 * at a stroke — the Snackbar slide, the modal pop-in, the menus, the buffering
 * spinner — while each state is still shown, because only time is collapsed.
 * `ffSpin` stays, and with motion allowed the spinner still turns.
 *
 * jsdom evaluates no media query, so the rule is read off the CSS
 * styled-components produces, whitespace aside. The one suite that does not
 * ask `resolvedStyle`: its subject is an at-rule on a global, which the double
 * deliberately does not read — it drops every at-rule, and a global's rules
 * never reach the document it reads.
 */

const REDUCED_MOTION = `
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}`;

function squash(css: string): string {
  return css.replace(/\s+/g, '');
}

/**
 * The CSS the global stylesheet and the buffering notice produce. A global's
 * rules never reach jsdom's document in this build of styled-components, so
 * they are collected the documented way, through a `ServerStyleSheet`.
 */
function renderedCss(): string {
  const sheet = new ServerStyleSheet();
  try {
    renderToString(
      sheet.collectStyles(
        <ThemeProvider theme={theme}>
          <GlobalStyle />
          <PlayerNotice kind="buffering" />
        </ThemeProvider>
      )
    );
    return squash(sheet.getStyleTags().replace(/\/\*!sc\*\//g, ''));
  } finally {
    sheet.seal();
  }
}

/** The body of the reduced-motion block, or null when there is none. */
function reducedMotionBody(css: string): string | null {
  const match =
    /@media\(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{([^}]*)\}\}/.exec(
      css
    );
  return match ? match[1] : null;
}

describe('GlobalStyle — Reduced motion', () => {
  it('carries the tokens.css block verbatim', () => {
    expect(renderedCss()).toContain(squash(REDUCED_MOTION));
  });

  it('collapses only time, so every state is still shown', () => {
    const body = reducedMotionBody(renderedCss());
    expect(body).not.toBeNull();

    const properties = (body ?? '')
      .split(';')
      .filter(Boolean)
      .map((declaration) => declaration.split(':')[0]);
    expect(properties.sort()).toEqual([
      'animation-duration',
      'animation-iteration-count',
      'transition-duration',
    ]);
  });

  it('is the one reduced-motion rule in the app — never per component', () => {
    // The Snackbar slide, the modal pop-in, the menus and the spinner are all
    // held by the global rule; none may carry a branch of its own, and none
    // may out-rank the rule with an !important of its own.
    expect(shippingSourcesMatching('src', /prefers-reduced-motion/)).toEqual([
      'src/styles/GlobalStyle.ts',
    ]);
    expect(
      shippingSourcesMatching('src', /(animation|transition)[^;`]*!important/)
    ).toEqual(['src/styles/GlobalStyle.ts']);
  });
});

describe('GlobalStyle — with motion allowed', () => {
  it('still defines ffSpin, and the buffering spinner still turns on it', () => {
    const css = renderedCss();

    expect(css).toContain('@keyframesffSpin');
    expect(css).toContain('animation:ffSpin0.9slinearinfinite');

    // Outside the reduce query nothing collapses a duration.
    const outside = css.replace(squash(REDUCED_MOTION), '');
    expect(css).not.toBe(outside);
    expect(outside).not.toContain('0.01ms');
  });
});
