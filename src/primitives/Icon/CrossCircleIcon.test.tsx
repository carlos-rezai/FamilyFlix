import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { CrossCircleIcon } from '@/primitives';

/**
 * 18 — Snackbar system, Phase 1: "the molecule" (issue #160).
 *
 * A circled ✕ — the `error` glyph of `mol.Snackbar.dc.html`, named for what it
 * draws: the ring at radius 9 stroked at 1.8 and the two strokes of the cross
 * `M15 9l-6 6M9 9l6 6` in one path at 2 with round caps. Both in
 * `currentColor`, the `UploadIcon` precedent, through `IconBase`: the 24×24
 * frame at the size it is given, decorative unless titled.
 */
const CROSS = 'M15 9l-6 6M9 9l6 6';

function renderIcon(props: { size?: number; title?: string } = {}) {
  const { container } = render(<CrossCircleIcon {...props} />);
  const svg = container.querySelector('svg');
  if (svg === null) {
    throw new Error('CrossCircleIcon drew no svg');
  }
  return svg;
}

describe('CrossCircleIcon', () => {
  it('draws the prototype’s circled cross: the ring and the two strokes', () => {
    const svg = renderIcon();
    const ring = svg.querySelector('circle');

    expect(ring?.getAttribute('cx')).toBe('12');
    expect(ring?.getAttribute('cy')).toBe('12');
    expect(ring?.getAttribute('r')).toBe('9');

    expect(svg.querySelector('path')?.getAttribute('d')).toBe(CROSS);
  });

  it('renders at the size given, on the shared 24×24 frame', () => {
    const svg = renderIcon({ size: 20 });

    expect(svg.getAttribute('width')).toBe('20');
    expect(svg.getAttribute('height')).toBe('20');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('strokes both in currentColor: the ring at 1.8, the cross at 2 round-capped', () => {
    const svg = renderIcon();
    const ring = svg.querySelector('circle');
    const cross = svg.querySelector('path');

    expect(ring?.getAttribute('stroke')).toBe('currentColor');
    expect(ring?.getAttribute('stroke-width')).toBe('1.8');
    expect(cross?.getAttribute('stroke')).toBe('currentColor');
    expect(cross?.getAttribute('stroke-width')).toBe('2');
    expect(cross?.getAttribute('stroke-linecap')).toBe('round');
  });

  it('is decorative unless titled', () => {
    expect(renderIcon().getAttribute('aria-hidden')).toBe('true');

    const titled = renderIcon({ title: 'Failed' });
    expect(titled.getAttribute('role')).toBe('img');
    expect(titled.querySelector('title')?.textContent).toBe('Failed');
  });
});
