import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { CheckCircleIcon } from '@/primitives';

/**
 * 18 — Snackbar system, Phase 1: "the molecule" (issue #160).
 *
 * A circled tick — the `success` glyph of `mol.Snackbar.dc.html`, named for
 * what it draws: the ring at radius 9 stroked at 1.8 and the tick
 * `M8 12.5l2.5 2.5L16 9.5` at 2, rounded at the cap and the join. Not the
 * existing `CheckIcon`, which is the watched toggle's bare tick and a different
 * shape. Both in `currentColor`, the `UploadIcon` precedent, through
 * `IconBase`: the 24×24 frame at the size it is given, decorative unless
 * titled.
 */
const TICK = 'M8 12.5l2.5 2.5L16 9.5';

function renderIcon(props: { size?: number; title?: string } = {}) {
  const { container } = render(<CheckCircleIcon {...props} />);
  const svg = container.querySelector('svg');
  if (svg === null) {
    throw new Error('CheckCircleIcon drew no svg');
  }
  return svg;
}

describe('CheckCircleIcon', () => {
  it('draws the prototype’s circled tick: the ring and the tick', () => {
    const svg = renderIcon();
    const ring = svg.querySelector('circle');

    expect(ring?.getAttribute('cx')).toBe('12');
    expect(ring?.getAttribute('cy')).toBe('12');
    expect(ring?.getAttribute('r')).toBe('9');

    expect(svg.querySelector('path')?.getAttribute('d')).toBe(TICK);
  });

  it('renders at the size given, on the shared 24×24 frame', () => {
    const svg = renderIcon({ size: 20 });

    expect(svg.getAttribute('width')).toBe('20');
    expect(svg.getAttribute('height')).toBe('20');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('strokes both in currentColor: the ring at 1.8, the tick at 2, rounded', () => {
    const svg = renderIcon();
    const ring = svg.querySelector('circle');
    const tick = svg.querySelector('path');

    expect(ring?.getAttribute('stroke')).toBe('currentColor');
    expect(ring?.getAttribute('stroke-width')).toBe('1.8');
    expect(tick?.getAttribute('stroke')).toBe('currentColor');
    expect(tick?.getAttribute('stroke-width')).toBe('2');
    expect(tick?.getAttribute('stroke-linecap')).toBe('round');
    expect(tick?.getAttribute('stroke-linejoin')).toBe('round');
  });

  it('is decorative unless titled', () => {
    expect(renderIcon().getAttribute('aria-hidden')).toBe('true');

    const titled = renderIcon({ title: 'Done' });
    expect(titled.getAttribute('role')).toBe('img');
    expect(titled.querySelector('title')?.textContent).toBe('Done');
  });
});
