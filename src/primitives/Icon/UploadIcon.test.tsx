import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { UploadIcon } from '@/primitives';

/**
 * 16 — Playback component upload, Phase 3: "the zone" (issue #154).
 *
 * The arrow-over-bar in the **Component drop zone**, from
 * `feat.CodecManager.dc.html`: one stroked path — a shaft up the middle, the
 * two barbs of its head, and the bar beneath it — at stroke 1.8, rounded at
 * both the caps and the joins.
 *
 * It strokes in `currentColor` rather than in the prototype's literal accent,
 * the `MicrochipIcon` precedent: the ink is the zone's to choose, and an atom
 * that hard-coded a token could not be reused by anything that wanted another.
 * It renders through `IconBase` like the rest — the 24×24 frame at the size it
 * is given, decorative unless titled.
 */
const ARROW_OVER_BAR = 'M12 16V4m0 0L8 8m4-4l4 4M5 20h14';

function renderIcon(props: { size?: number; title?: string } = {}) {
  const { container } = render(<UploadIcon {...props} />);
  const svg = container.querySelector('svg');
  if (svg === null) {
    throw new Error('UploadIcon drew no svg');
  }
  return svg;
}

describe('UploadIcon', () => {
  it('draws the prototype’s arrow over its bar', () => {
    const svg = renderIcon();

    expect(svg.querySelector('path')?.getAttribute('d')).toBe(ARROW_OVER_BAR);
  });

  it('renders at the size given, on the shared 24×24 frame', () => {
    const svg = renderIcon({ size: 28 });

    expect(svg.getAttribute('width')).toBe('28');
    expect(svg.getAttribute('height')).toBe('28');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('strokes in currentColor at the prototype’s 1.8, rounded', () => {
    const path = renderIcon().querySelector('path');

    expect(path?.getAttribute('stroke')).toBe('currentColor');
    expect(path?.getAttribute('stroke-width')).toBe('1.8');
    expect(path?.getAttribute('stroke-linecap')).toBe('round');
    expect(path?.getAttribute('stroke-linejoin')).toBe('round');
  });

  it('is decorative unless titled', () => {
    expect(renderIcon().getAttribute('aria-hidden')).toBe('true');

    const titled = renderIcon({ title: 'Add a codec pack' });
    expect(titled.getAttribute('role')).toBe('img');
    expect(titled.querySelector('title')?.textContent).toBe('Add a codec pack');
  });
});
