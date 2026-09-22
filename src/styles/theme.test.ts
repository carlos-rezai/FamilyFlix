import { describe, it, expect, expectTypeOf } from 'vitest';
import type { DefaultTheme } from 'styled-components';

import { colors, motion } from '@/tokens';
import { accentScale } from '@/utils/accentScale/accentScale';

import { createTheme, theme } from './theme';

/**
 * 21 — Motion & interaction states, Phase 1 (issue #181).
 *
 * The theme factory: `createTheme(accent = colors.accent)` spreads the
 * **Accent scale** derived from the one accent over the colour tokens and
 * mounts the **Motion tokens** as `theme.motion`. `theme` is `createTheme()`.
 * The colour tokens spell the accent once and none of its derivatives — they
 * are computed, never re-typed.
 */

const MOTION = {
  durFast: '120ms',
  durBase: '180ms',
  durSlow: '280ms',
  easeOut: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
};

describe('the Motion tokens', () => {
  it('ship the prototype scale whole, through the tokens barrel', () => {
    expect(motion).toEqual(MOTION);
  });
});

describe('createTheme — the stock accent', () => {
  it('exposes the five derived colours beside the accent', () => {
    const made = createTheme();

    expect(made.colors.accent).toBe('#d97a4e');
    expect(made.colors.accentHover).toBe('#e0926e');
    expect(made.colors.accentPress).toBe('#bf6b45');
    expect(made.colors.accentSoft).toBe('rgba(217, 122, 78, 0.14)');
    expect(made.colors.accentLine).toBe('rgba(217, 122, 78, 0.32)');
    expect(made.colors.focusRing).toBe('rgba(224, 146, 110, 0.55)');
  });

  it("mounts the motion tokens' four values", () => {
    expect(createTheme().motion).toEqual(MOTION);
  });

  it('keeps every other colour token as it was', () => {
    const made = createTheme();

    expect(made.colors.bg).toBe(colors.bg);
    expect(made.colors.surface2).toBe(colors.surface2);
    expect(made.colors.textFaint).toBe(colors.textFaint);
    expect(made.colors.danger).toBe(colors.danger);
  });

  it('is the theme the app provides', () => {
    expect(theme).toEqual(createTheme());
  });
});

describe('createTheme — another accent', () => {
  it('derives its scale from the accent it is given', () => {
    const made = createTheme('#4e8ad9');
    const scale = accentScale('#4e8ad9');

    expect(made.colors.accentHover).toBe(scale.accentHover);
    expect(made.colors.accentPress).toBe(scale.accentPress);
    expect(made.colors.accentSoft).toBe(scale.accentSoft);
    expect(made.colors.accentLine).toBe(scale.accentLine);
    expect(made.colors.focusRing).toBe(scale.focusRing);
  });
});

describe('the colour tokens', () => {
  it('spell the accent once and none of its derivatives', () => {
    const values: string[] = Object.values(colors);
    const derived = Object.values(accentScale(colors.accent));

    expect(values.filter((value) => value === colors.accent)).toHaveLength(1);
    expect(values.filter((value) => derived.includes(value))).toEqual([]);
    // The accent's own channels, at any alpha, are a derivative re-typed.
    expect(values.filter((value) => value.includes('217, 122, 78'))).toEqual(
      []
    );
    expect(colors).not.toHaveProperty('accentHover');
    expect(colors).not.toHaveProperty('accentSoft');
    expect(colors).not.toHaveProperty('accentLine');
  });
});

describe('the readers of the accent names', () => {
  it('still find all five on the styled-components theme type', () => {
    expectTypeOf<DefaultTheme['colors']['accentHover']>().toBeString();
    expectTypeOf<DefaultTheme['colors']['accentSoft']>().toBeString();
    expectTypeOf<DefaultTheme['colors']['accentLine']>().toBeString();
    expectTypeOf<DefaultTheme['colors']['accentPress']>().toBeString();
    expectTypeOf<DefaultTheme['colors']['focusRing']>().toBeString();
    expectTypeOf<DefaultTheme['motion']['durFast']>().toBeString();

    const made = createTheme();
    expect(Object.keys(made.colors)).toEqual(
      expect.arrayContaining([
        'accentHover',
        'accentSoft',
        'accentLine',
        'accentPress',
        'focusRing',
      ])
    );
  });
});
