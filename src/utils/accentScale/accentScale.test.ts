import { describe, it, expect } from 'vitest';

import { accentScale } from './accentScale';

/**
 * 21 — Motion & interaction states, Phase 1: "the Motion tokens, the Accent
 * scale, the theme factory and Reduced motion" (issue #181).
 *
 * `accentScale(accent)` derives the **Accent scale** — the accent's five
 * derivatives — the way the prototype does: hover is the accent 18% of the
 * way to white, press 12% of the way to black, soft and line are the accent at
 * 14% and 32% alpha, and the focus ring is the hover at 55%. The stock accent
 * maps to exactly the values `tokens.css` was amended to. A derivative is
 * never an alias: alias hover to the accent and every primary button silently
 * loses its hover.
 */

const STOCK = '#d97a4e';
const SECOND = '#4e8ad9';

describe('accentScale — the stock accent', () => {
  it('derives exactly the five values of the amended tokens.css', () => {
    expect(accentScale(STOCK)).toEqual({
      accentHover: '#e0926e',
      accentPress: '#bf6b45',
      accentSoft: 'rgba(217, 122, 78, 0.14)',
      accentLine: 'rgba(217, 122, 78, 0.32)',
      focusRing: 'rgba(224, 146, 110, 0.55)',
    });
  });
});

describe('accentScale — another accent', () => {
  it('derives a different scale from a different accent', () => {
    const stock = accentScale(STOCK);
    const second = accentScale(SECOND);

    expect(second.accentHover).not.toBe(stock.accentHover);
    expect(second.accentPress).not.toBe(stock.accentPress);
    expect(second.accentSoft).not.toBe(stock.accentSoft);
    expect(second.accentLine).not.toBe(stock.accentLine);
    expect(second.focusRing).not.toBe(stock.focusRing);
  });

  it('carries the accent it was given into its soft and line tints', () => {
    const second = accentScale(SECOND);

    expect(second.accentSoft).toBe('rgba(78, 138, 217, 0.14)');
    expect(second.accentLine).toBe('rgba(78, 138, 217, 0.32)');
  });
});

describe('accentScale — never aliased', () => {
  it.each([STOCK, SECOND])(
    'neither hover nor press of %s equals the accent',
    (accent) => {
      const scale = accentScale(accent);

      expect(scale.accentHover.toLowerCase()).not.toBe(accent);
      expect(scale.accentPress.toLowerCase()).not.toBe(accent);
      expect(scale.accentHover).not.toBe(scale.accentPress);
    }
  );
});
