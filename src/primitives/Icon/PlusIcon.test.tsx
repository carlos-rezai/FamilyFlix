import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { PlusIcon } from '@/primitives';

/**
 * 19 — Back-to-top FAB, Phase 1: "the molecule" (issue #166).
 *
 * The plus the **FAB** carries as its other glyph, from `mol.Fab.dc.html`:
 * one stroked path — a vertical and a horizontal through the centre — at
 * stroke 2.2 with round caps. It ships though no screen draws it yet: half an
 * enum is a deviation dressed up as restraint. Named for what it draws.
 *
 * It strokes in `currentColor`, the `UploadIcon` precedent, so the ink is the
 * circle's to choose. Its size — 26 in the prototype — is the molecule's to
 * pass, not this glyph's to know: it renders through `IconBase` like the rest,
 * the 24×24 frame at the size it is given, decorative unless titled.
 */
const PLUS = 'M12 5v14M5 12h14';

function renderIcon(props: { size?: number; title?: string } = {}) {
  const { container } = render(<PlusIcon {...props} />);
  const svg = container.querySelector('svg');
  if (svg === null) {
    throw new Error('PlusIcon drew no svg');
  }
  return svg;
}

describe('PlusIcon', () => {
  it('draws the prototype’s plus', () => {
    const svg = renderIcon();

    expect(svg.querySelector('path')?.getAttribute('d')).toBe(PLUS);
  });

  it('renders at the size given, on the shared 24×24 frame', () => {
    const svg = renderIcon({ size: 26 });

    expect(svg.getAttribute('width')).toBe('26');
    expect(svg.getAttribute('height')).toBe('26');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('strokes in currentColor at the prototype’s 2.2, with round caps', () => {
    const path = renderIcon().querySelector('path');

    expect(path?.getAttribute('stroke')).toBe('currentColor');
    expect(path?.getAttribute('stroke-width')).toBe('2.2');
    expect(path?.getAttribute('stroke-linecap')).toBe('round');
  });

  it('is decorative unless titled', () => {
    expect(renderIcon().getAttribute('aria-hidden')).toBe('true');

    const titled = renderIcon({ title: 'Add' });
    expect(titled.getAttribute('role')).toBe('img');
    expect(titled.querySelector('title')?.textContent).toBe('Add');
  });
});
