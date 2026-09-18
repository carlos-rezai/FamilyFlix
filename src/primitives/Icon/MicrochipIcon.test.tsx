import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { MicrochipIcon } from '@/primitives';

/**
 * 15 — Settings hub, Phase 1: "the tracer bullet" (issue #143).
 *
 * The glyph in a **Codec row**'s tile — the prototype's rect-and-pins at
 * stroke 1.6 in `currentColor`, from `feat.CodecManager.dc.html`: a rounded
 * 12×12 square at the centre of the frame and eight pins, two off each side.
 * It renders through `IconBase` like the other icons, the `DownloadIcon`
 * precedent: the 24×24 frame at the size it is given, decorative unless
 * titled.
 */
const PINS = 'M10 6V3M14 6V3M10 18v3M14 18v3M6 10H3M6 14H3M18 10h3M18 14h3';

function renderIcon(props: { size?: number; title?: string } = {}) {
  const { container } = render(<MicrochipIcon {...props} />);
  const svg = container.querySelector('svg');
  if (svg === null) {
    throw new Error('MicrochipIcon drew no svg');
  }
  return svg;
}

describe('MicrochipIcon', () => {
  it('draws the prototype’s chip: the rounded square and the pins', () => {
    const svg = renderIcon();

    const rect = svg.querySelector('rect');
    expect(rect?.getAttribute('x')).toBe('6');
    expect(rect?.getAttribute('y')).toBe('6');
    expect(rect?.getAttribute('width')).toBe('12');
    expect(rect?.getAttribute('height')).toBe('12');
    expect(rect?.getAttribute('rx')).toBe('2.5');

    const path = svg.querySelector('path');
    expect(path?.getAttribute('d')).toBe(PINS);
  });

  it('renders at the size given, on the shared 24×24 frame', () => {
    const svg = renderIcon({ size: 20 });

    expect(svg.getAttribute('width')).toBe('20');
    expect(svg.getAttribute('height')).toBe('20');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('strokes both in currentColor at the prototype’s 1.6, the pins round-capped', () => {
    const svg = renderIcon();
    const rect = svg.querySelector('rect');
    const path = svg.querySelector('path');

    expect(rect?.getAttribute('stroke')).toBe('currentColor');
    expect(rect?.getAttribute('stroke-width')).toBe('1.6');
    expect(path?.getAttribute('stroke')).toBe('currentColor');
    expect(path?.getAttribute('stroke-width')).toBe('1.6');
    expect(path?.getAttribute('stroke-linecap')).toBe('round');
  });

  it('is decorative unless titled', () => {
    expect(renderIcon().getAttribute('aria-hidden')).toBe('true');

    const titled = renderIcon({ title: 'Codec' });
    expect(titled.getAttribute('role')).toBe('img');
    expect(titled.querySelector('title')?.textContent).toBe('Codec');
  });
});
