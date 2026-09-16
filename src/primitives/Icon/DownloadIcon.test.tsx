import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { DownloadIcon } from '@/primitives';

/**
 * 14 — Export, Phase 1: "the tracer bullet" (issue #137).
 *
 * The download glyph in the **Export dialog**'s accent tile — the prototype's
 * path at stroke 1.9 in `currentColor`, from `feat.ExportModal.dc.html`. It
 * renders through `IconBase` like the other icons: the 24×24 frame at the size
 * it is given, decorative unless titled.
 */
const PATH = 'M12 3v11m0 0l-4-4m4 4l4-4M5 19h14';

function renderIcon(props: { size?: number; title?: string } = {}) {
  const { container } = render(<DownloadIcon {...props} />);
  const svg = container.querySelector('svg');
  if (svg === null) {
    throw new Error('DownloadIcon drew no svg');
  }
  return svg;
}

describe('DownloadIcon', () => {
  it('draws the prototype’s path', () => {
    const svg = renderIcon();

    const path = svg.querySelector('path');
    expect(path?.getAttribute('d')).toBe(PATH);
  });

  it('renders at the size given, on the shared 24×24 frame', () => {
    const svg = renderIcon({ size: 22 });

    expect(svg.getAttribute('width')).toBe('22');
    expect(svg.getAttribute('height')).toBe('22');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('strokes in currentColor at the prototype’s 1.9, with round caps and joins', () => {
    const path = renderIcon().querySelector('path');

    expect(path?.getAttribute('stroke')).toBe('currentColor');
    expect(path?.getAttribute('stroke-width')).toBe('1.9');
    expect(path?.getAttribute('stroke-linecap')).toBe('round');
    expect(path?.getAttribute('stroke-linejoin')).toBe('round');
  });

  it('is decorative unless titled', () => {
    expect(renderIcon().getAttribute('aria-hidden')).toBe('true');

    const titled = renderIcon({ title: 'Download' });
    expect(titled.getAttribute('role')).toBe('img');
    expect(titled.querySelector('title')?.textContent).toBe('Download');
  });
});
