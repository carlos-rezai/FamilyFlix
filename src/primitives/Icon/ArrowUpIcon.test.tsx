import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { ArrowUpIcon } from '@/primitives';

/**
 * 19 — Back-to-top FAB, Phase 1: "the molecule" (issue #166).
 *
 * The arrow the **FAB** carries when it is a **Back-to-top**, from
 * `mol.Fab.dc.html`: one stroked path — a shaft up the middle and the two
 * barbs of its head — at stroke 2.2, rounded at both the caps and the joins.
 * Named for what it draws, not for the screen that draws it: a primitive
 * knows nothing about a threshold.
 *
 * It strokes in `currentColor`, the `UploadIcon` precedent, so the ink is the
 * circle's to choose. Its size — 24 in the prototype — is the molecule's to
 * pass, not this glyph's to know: it renders through `IconBase` like the rest,
 * the 24×24 frame at the size it is given, decorative unless titled.
 */
const ARROW_UP = 'M12 19V5m0 0l-6 6m6-6l6 6';

function renderIcon(props: { size?: number; title?: string } = {}) {
  const { container } = render(<ArrowUpIcon {...props} />);
  const svg = container.querySelector('svg');
  if (svg === null) {
    throw new Error('ArrowUpIcon drew no svg');
  }
  return svg;
}

describe('ArrowUpIcon', () => {
  it('draws the prototype’s arrow, shaft and head', () => {
    const svg = renderIcon();

    expect(svg.querySelector('path')?.getAttribute('d')).toBe(ARROW_UP);
  });

  it('renders at the size given, on the shared 24×24 frame', () => {
    const svg = renderIcon({ size: 24 });

    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('strokes in currentColor at the prototype’s 2.2, rounded at caps and joins', () => {
    const path = renderIcon().querySelector('path');

    expect(path?.getAttribute('stroke')).toBe('currentColor');
    expect(path?.getAttribute('stroke-width')).toBe('2.2');
    expect(path?.getAttribute('stroke-linecap')).toBe('round');
    expect(path?.getAttribute('stroke-linejoin')).toBe('round');
  });

  it('is decorative unless titled', () => {
    expect(renderIcon().getAttribute('aria-hidden')).toBe('true');

    const titled = renderIcon({ title: 'Back to top' });
    expect(titled.getAttribute('role')).toBe('img');
    expect(titled.querySelector('title')?.textContent).toBe('Back to top');
  });
});
