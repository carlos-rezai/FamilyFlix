import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { InfoCircleIcon } from '@/primitives';

/**
 * 18 — Snackbar system, Phase 1: "the molecule" (issue #160).
 *
 * A circled `i` — the `info` glyph of `mol.Snackbar.dc.html`, named for what
 * it draws because an atom knows nothing about the domain: the ring at radius
 * 9 stroked at 1.8, the stem `M12 11v5` at 2 with a round cap, and the dot at
 * (12, 7.6) filled. Every one in `currentColor`, so the ink is the caller's to
 * choose — the `UploadIcon` precedent. It renders through `IconBase` like the
 * rest: the 24×24 frame at the size it is given, decorative unless titled.
 */
const STEM = 'M12 11v5';

function renderIcon(props: { size?: number; title?: string } = {}) {
  const { container } = render(<InfoCircleIcon {...props} />);
  const svg = container.querySelector('svg');
  if (svg === null) {
    throw new Error('InfoCircleIcon drew no svg');
  }
  return svg;
}

describe('InfoCircleIcon', () => {
  it('draws the prototype’s circled i: the ring, the stem and the dot', () => {
    const svg = renderIcon();
    const [ring, dot] = Array.from(svg.querySelectorAll('circle'));

    expect(ring?.getAttribute('cx')).toBe('12');
    expect(ring?.getAttribute('cy')).toBe('12');
    expect(ring?.getAttribute('r')).toBe('9');

    expect(svg.querySelector('path')?.getAttribute('d')).toBe(STEM);

    expect(dot?.getAttribute('cx')).toBe('12');
    expect(dot?.getAttribute('cy')).toBe('7.6');
    expect(dot?.getAttribute('r')).toBe('1.2');
  });

  it('renders at the size given, on the shared 24×24 frame', () => {
    const svg = renderIcon({ size: 20 });

    expect(svg.getAttribute('width')).toBe('20');
    expect(svg.getAttribute('height')).toBe('20');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('inks in currentColor: the ring at 1.8, the stem at 2 round-capped, the dot filled', () => {
    const svg = renderIcon();
    const [ring, dot] = Array.from(svg.querySelectorAll('circle'));
    const stem = svg.querySelector('path');

    expect(ring?.getAttribute('stroke')).toBe('currentColor');
    expect(ring?.getAttribute('stroke-width')).toBe('1.8');
    expect(stem?.getAttribute('stroke')).toBe('currentColor');
    expect(stem?.getAttribute('stroke-width')).toBe('2');
    expect(stem?.getAttribute('stroke-linecap')).toBe('round');
    expect(dot?.getAttribute('fill')).toBe('currentColor');
  });

  it('is decorative unless titled', () => {
    expect(renderIcon().getAttribute('aria-hidden')).toBe('true');

    const titled = renderIcon({ title: 'Information' });
    expect(titled.getAttribute('role')).toBe('img');
    expect(titled.querySelector('title')?.textContent).toBe('Information');
  });
});
