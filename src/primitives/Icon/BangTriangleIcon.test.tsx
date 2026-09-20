import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { BangTriangleIcon } from '@/primitives';

/**
 * 18 — Snackbar system, Phase 1: "the molecule" (issue #160).
 *
 * A triangle with a bang — the `warning` glyph of `mol.Snackbar.dc.html`,
 * named for what it draws: the triangle `M12 3.5l9 16H3l9-16z` stroked at 1.8
 * with round joins, the stem `M12 10v4` at 2 with a round cap, and the dot at
 * (12, 17) filled. Every one in `currentColor`, the `UploadIcon` precedent,
 * through `IconBase`: the 24×24 frame at the size it is given, decorative
 * unless titled.
 */
const TRIANGLE = 'M12 3.5l9 16H3l9-16z';
const STEM = 'M12 10v4';

function renderIcon(props: { size?: number; title?: string } = {}) {
  const { container } = render(<BangTriangleIcon {...props} />);
  const svg = container.querySelector('svg');
  if (svg === null) {
    throw new Error('BangTriangleIcon drew no svg');
  }
  return svg;
}

describe('BangTriangleIcon', () => {
  it('draws the prototype’s triangle with a bang: the outline, the stem and the dot', () => {
    const svg = renderIcon();
    const [triangle, stem] = Array.from(svg.querySelectorAll('path'));
    const dot = svg.querySelector('circle');

    expect(triangle?.getAttribute('d')).toBe(TRIANGLE);
    expect(stem?.getAttribute('d')).toBe(STEM);

    expect(dot?.getAttribute('cx')).toBe('12');
    expect(dot?.getAttribute('cy')).toBe('17');
    expect(dot?.getAttribute('r')).toBe('1.1');
  });

  it('renders at the size given, on the shared 24×24 frame', () => {
    const svg = renderIcon({ size: 20 });

    expect(svg.getAttribute('width')).toBe('20');
    expect(svg.getAttribute('height')).toBe('20');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('inks in currentColor: the triangle at 1.8 round-joined, the stem at 2 round-capped, the dot filled', () => {
    const svg = renderIcon();
    const [triangle, stem] = Array.from(svg.querySelectorAll('path'));
    const dot = svg.querySelector('circle');

    expect(triangle?.getAttribute('stroke')).toBe('currentColor');
    expect(triangle?.getAttribute('stroke-width')).toBe('1.8');
    expect(triangle?.getAttribute('stroke-linejoin')).toBe('round');
    expect(stem?.getAttribute('stroke')).toBe('currentColor');
    expect(stem?.getAttribute('stroke-width')).toBe('2');
    expect(stem?.getAttribute('stroke-linecap')).toBe('round');
    expect(dot?.getAttribute('fill')).toBe('currentColor');
  });

  it('is decorative unless titled', () => {
    expect(renderIcon().getAttribute('aria-hidden')).toBe('true');

    const titled = renderIcon({ title: 'Caution' });
    expect(titled.getAttribute('role')).toBe('img');
    expect(titled.querySelector('title')?.textContent).toBe('Caution');
  });
});
