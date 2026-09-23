import { describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import styled, { ThemeProvider } from 'styled-components';

import {
  normCss,
  resolvedStyle,
  type StyleState,
} from '@/test-support/resolvedStyle/resolvedStyle';
import { shippingSourcesMatching } from '@/test-support/shippingSources/shippingSources';
import { theme } from '@/styles/theme';

import { cardFocus, cardLift, controlStates } from './interactionStates';

/**
 * 21 — Motion & interaction states, Phase 2 (issue #182).
 *
 * The **Control** vocabulary's fragment, and the **structural guard** that
 * keeps every duration and curve in one place. jsdom computes no `:hover`,
 * `:active` or `:focus-visible`, so each probe is rendered into the document
 * and `resolvedStyle` runs the cascade for the named state — what wins, never
 * a computed style and never merely what was written.
 */

/** The three motion durations and the curve, spelled anywhere but the tokens. */
const MOTION_LITERAL = /(?<![\d.])(120|180|280)ms|cubic-bezier\(/;
/** The Control's press, spelled anywhere but the fragment. */
const CONTROL_PRESS = /(?<![\d.])60ms/;
/** The Card's press, spelled anywhere but the fragment (issue #185). */
const CARD_PRESS = /(?<![\d.])70ms/;

/** A plain element on the fragment, pressing at `scale(.98)`. */
const Probe = styled.button`
  ${controlStates('scale(.98)')}
`;

/** What the probe resolves to in `state`, rendered afresh each time. */
function probe(state: StyleState = {}): Record<string, string> {
  cleanup();
  render(
    <ThemeProvider theme={theme}>
      <Probe type="button">Probe</Probe>
    </ThemeProvider>
  );
  return resolvedStyle(screen.getByRole('button', { name: 'Probe' }), state);
}

/** Every duration in a value `normCss` has tidied. */
function milliseconds(value: string): number[] {
  return [...value.matchAll(/(\d*\.?\d+)(ms|s)(?![\w-])/g)].map(
    ([, n, unit]) => (unit === 's' ? Number(n) * 1000 : Number(n))
  );
}

describe('the structural guard — its patterns', () => {
  it('catches each motion duration and the curve, spelled out', () => {
    expect(MOTION_LITERAL.test('transition: color 120ms ease')).toBe(true);
    expect(MOTION_LITERAL.test('transform 180ms')).toBe(true);
    expect(MOTION_LITERAL.test('opacity 280ms')).toBe(true);
    expect(MOTION_LITERAL.test('cubic-bezier(.2,.7,.3,1)')).toBe(true);
  });

  it('does not mistake a longer literal or a token read for one', () => {
    expect(MOTION_LITERAL.test('1120ms')).toBe(false);
    expect(MOTION_LITERAL.test('0.18s ease')).toBe(false);
    expect(MOTION_LITERAL.test('theme.motion.durFast')).toBe(false);
  });

  it('catches the 60ms press, and not 160ms or 0.6s', () => {
    expect(CONTROL_PRESS.test('transition-duration: 60ms')).toBe(true);
    expect(CONTROL_PRESS.test('transition-duration: 160ms')).toBe(false);
    expect(CONTROL_PRESS.test('transition-duration: 0.6s')).toBe(false);
  });
});

describe('the structural guard — its 70ms clause (issue #185)', () => {
  it('catches the 70ms press, and not 170ms or 0.7s', () => {
    expect(CARD_PRESS.test('transition-duration: 70ms')).toBe(true);
    expect(CARD_PRESS.test('transition-duration: 170ms')).toBe(false);
    expect(CARD_PRESS.test('transition-duration: 0.7s')).toBe(false);
  });
});

describe('the structural guard — over the shipping tree', () => {
  it('lets no shipping file but the motion tokens spell a duration or the curve', () => {
    expect(shippingSourcesMatching('src', MOTION_LITERAL)).toEqual([
      'src/tokens/motion.ts',
    ]);
  });

  it('lets no shipping file but the fragment spell the 60ms press', () => {
    expect(shippingSourcesMatching('src', CONTROL_PRESS)).toEqual([
      'src/styles/interactionStates/interactionStates.ts',
    ]);
  });

  it('lets no shipping file but the fragment spell the 70ms press', () => {
    expect(shippingSourcesMatching('src', CARD_PRESS)).toEqual([
      'src/styles/interactionStates/interactionStates.ts',
    ]);
  });
});

describe('controlStates — the Control vocabulary', () => {
  it('eases background, border, colour, transform and shadow at durFast on easeOut', () => {
    const transition = probe().transition ?? '';

    for (const property of [
      'background',
      'border-color',
      'color',
      'transform',
      'box-shadow',
    ]) {
      expect(transition).toContain(
        normCss(`${property} ${theme.motion.durFast} ${theme.motion.easeOut}`)
      );
    }
  });

  it('presses anything not disabled at the given transform, in 60ms', () => {
    const press = probe({ active: true });

    expect(press.transform).toBe(normCss('scale(.98)'));
    expect(press['transition-duration']).toBe('60ms');
  });

  it('presses visibly faster than the hover eases in', () => {
    const press = milliseconds(probe({ active: true })['transition-duration']);
    const hover = milliseconds(probe().transition ?? '');

    expect(press).toHaveLength(1);
    expect(hover.length).toBeGreaterThan(0);
    expect(press[0]).toBeLessThan(Math.min(...hover));
  });

  it('draws the 3px Focus ring as a shadow under keyboard focus, so it follows the corners', () => {
    const focus = probe({ focusVisible: true });

    expect(focus.outline).toBe('none');
    expect(focus['box-shadow']).toBe(
      normCss(`0 0 0 3px ${theme.colors.focusRing}`)
    );
  });

  it('draws no ring for a click: nothing styles plain :focus', () => {
    const click = probe({ focus: true });

    expect(click['box-shadow']).toBeUndefined();
    expect(click.outline).toBeUndefined();
  });
});

/**
 * 21 — Motion & interaction states, Phase 5 (issue #185).
 *
 * The **Card** vocabulary: a Card signals with elevation, never with colour.
 * Two fragments, because the prototype puts the lift on the tile and the
 * focus on the root — hovering the title under a poster does not lift it.
 */
const TileProbe = styled.div`
  ${cardLift}
`;

const RootProbe = styled.div`
  ${cardFocus}
`;

function tile(state: StyleState = {}): Record<string, string> {
  cleanup();
  render(
    <ThemeProvider theme={theme}>
      <TileProbe data-testid="tile" />
    </ThemeProvider>
  );
  return resolvedStyle(screen.getByTestId('tile'), state);
}

function root(state: StyleState = {}): Record<string, string> {
  cleanup();
  render(
    <ThemeProvider theme={theme}>
      <RootProbe data-testid="root" tabIndex={0} />
    </ThemeProvider>
  );
  return resolvedStyle(screen.getByTestId('root'), state);
}

describe('cardLift — the Card vocabulary, on the tile', () => {
  it('rests on the 0 6px 20px shadow', () => {
    expect(tile()['box-shadow']).toBe(normCss('0 6px 20px rgba(0,0,0,.35)'));
  });

  it('eases transform, shadow and border at durBase on easeOut', () => {
    const transition = tile().transition ?? '';

    for (const property of ['transform', 'box-shadow', 'border-color']) {
      expect(transition).toContain(
        normCss(`${property} ${theme.motion.durBase} ${theme.motion.easeOut}`)
      );
    }
  });

  it('lifts 4px on hover, with the deeper shadow and the accentLine border', () => {
    const hover = tile({ hover: true });

    expect(hover.transform).toBe('translateY(-4px)');
    expect(hover['box-shadow']).toBe(normCss('0 14px 34px rgba(0,0,0,.5)'));
    expect(hover['border-color']).toBe(normCss(theme.colors.accentLine));
  });

  it('settles to translateY(-1px) on press, in 70ms', () => {
    const press = tile({ hover: true, active: true });

    expect(press.transform).toBe('translateY(-1px)');
    expect(press['transition-duration']).toBe('70ms');
  });
});

describe('cardFocus — the Card vocabulary, on the focusable root', () => {
  it('draws a 2px focusRing outline 4px out under keyboard focus', () => {
    const focus = root({ focusVisible: true });

    expect(focus.outline).toBe(normCss(`2px solid ${theme.colors.focusRing}`));
    expect(focus['outline-offset']).toBe('4px');
  });

  it('leaves the radius to the caller', () => {
    const focus = root({ focusVisible: true });

    expect(focus['outline-offset']).toBe('4px');
    expect(focus['border-radius']).toBeUndefined();
    expect(root()['border-radius']).toBeUndefined();
  });
});
