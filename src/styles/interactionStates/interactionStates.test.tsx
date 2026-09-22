import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import styled, { ServerStyleSheet, ThemeProvider } from 'styled-components';

import { shippingSourcesMatching } from '@/test-support/shippingSources/shippingSources';
import { theme } from '@/styles/theme';

import { controlStates } from './interactionStates';

/**
 * 21 — Motion & interaction states, Phase 2 (issue #182).
 *
 * The **Control** vocabulary's fragment, and the **structural guard** that
 * keeps every duration and curve in one place. jsdom computes no `:hover`,
 * `:active` or `:focus-visible`, so what is held here is the rule the fragment
 * writes — read off the CSS styled-components produces, whitespace aside —
 * never a computed style.
 */

/** The three motion durations and the curve, spelled anywhere but the tokens. */
const MOTION_LITERAL = /(?<![\d.])(120|180|280)ms|cubic-bezier\(/;
/** The Control's press, spelled anywhere but the fragment. */
const CONTROL_PRESS = /(?<![\d.])60ms/;

function squash(css: string): string {
  return css.replace(/\s+/g, '');
}

interface Rule {
  selector: string;
  body: string;
}

/** Every flat rule in the CSS a styled tree produces. */
function renderedRules(tree: ReactElement): Rule[] {
  const sheet = new ServerStyleSheet();
  try {
    renderToString(
      sheet.collectStyles(<ThemeProvider theme={theme}>{tree}</ThemeProvider>)
    );
    const css = squash(
      sheet
        .getStyleTags()
        .replace(/<\/?style[^>]*>/g, '')
        .replace(/\/\*!sc\*\//g, '')
    );
    return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
      selector: m[1],
      body: m[2],
    }));
  } finally {
    sheet.seal();
  }
}

/** The declarations of every rule whose selector ends with `suffix`. */
function declarations(rules: Rule[], suffix: string): string {
  return rules
    .filter((rule) => rule.selector.endsWith(suffix))
    .map((rule) => rule.body)
    .join(';');
}

/** The rules a plain element on the fragment gets, pressing at `press`. */
const Probe = styled.button`
  ${controlStates('scale(.98)')}
`;

function probeRules(): Rule[] {
  return renderedRules(<Probe type="button">Probe</Probe>);
}

/** The resting rule: the one selector with no pseudo-class on it. */
function restingBody(rules: Rule[]): string {
  return rules
    .filter((rule) => !rule.selector.includes(':'))
    .map((rule) => rule.body)
    .join(';');
}

/**
 * Every duration in a squashed value. No `\b` after the unit: with the
 * whitespace gone, `120ms cubic-bezier(` reads `120mscubic-bezier(`.
 */
function milliseconds(value: string): number[] {
  return [...value.matchAll(/(\d*\.?\d+)(ms|s)/g)].map(([, n, unit]) =>
    unit === 's' ? Number(n) * 1000 : Number(n)
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
});

describe('controlStates — the Control vocabulary', () => {
  it('eases background, border, colour, transform and shadow at durFast on easeOut', () => {
    const resting = restingBody(probeRules());
    const transition = /transition:([^;]*)/.exec(resting)?.[1] ?? '';

    for (const property of [
      'background',
      'border-color',
      'color',
      'transform',
      'box-shadow',
    ]) {
      expect(transition).toContain(
        squash(`${property} ${theme.motion.durFast} ${theme.motion.easeOut}`)
      );
    }
  });

  it('presses anything not disabled at the given transform, in 60ms', () => {
    const press = declarations(probeRules(), ':active:not(:disabled)');

    expect(press).toContain('transform:scale(.98)');
    expect(press).toContain('transition-duration:60ms');
  });

  it('presses visibly faster than the hover eases in', () => {
    const rules = probeRules();
    const press = milliseconds(
      /transition-duration:([^;]*)/.exec(
        declarations(rules, ':active:not(:disabled)')
      )?.[1] ?? ''
    );
    const hover = milliseconds(
      /transition:([^;]*)/.exec(restingBody(rules))?.[1] ?? ''
    );

    expect(press).toHaveLength(1);
    expect(hover.length).toBeGreaterThan(0);
    expect(press[0]).toBeLessThan(Math.min(...hover));
  });

  it('draws the 3px Focus ring as a shadow under keyboard focus, so it follows the corners', () => {
    const focus = declarations(probeRules(), ':focus-visible');

    expect(focus).toContain('outline:none');
    expect(focus).toContain(
      squash(`box-shadow: 0 0 0 3px ${theme.colors.focusRing}`)
    );
  });

  it('draws no ring for a click: nothing styles plain :focus', () => {
    const plainFocus = probeRules().filter((rule) =>
      /:focus(?!-visible)/.test(rule.selector)
    );

    expect(plainFocus).toEqual([]);
  });
});
