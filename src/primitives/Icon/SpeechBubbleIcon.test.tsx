import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { SpeechBubbleIcon } from '@/primitives';

/**
 * 46 — Audio tracks, Phase 5: "the picker" (issue #403).
 *
 * The glyph the **Audio picker** carries, from `feat.PlayerControls.dc.html`:
 * a speech bubble — a rounded box with its tail at the lower left — and two
 * lines of speech inside it, stroked at the prototype's 1.8. Named for what it
 * draws, not for the menu that draws it: a primitive knows nothing about
 * audio tracks.
 *
 * It strokes in `currentColor`, so the ink is the chrome's, and renders through
 * `IconBase` like the rest — the 24×24 frame at the size it is given,
 * decorative unless titled.
 */
const BUBBLE =
  'M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2h-7l-4.5 3.5V17H5a2 2 0 01-2-2V7a2 2 0 012-2z';
const LINES = 'M8 10h8M8 13h5';

function renderIcon(props: { size?: number; title?: string } = {}) {
  const { container } = render(<SpeechBubbleIcon {...props} />);
  const svg = container.querySelector('svg');
  if (svg === null) {
    throw new Error('SpeechBubbleIcon drew no svg');
  }
  return svg;
}

describe('SpeechBubbleIcon', () => {
  it('draws the prototype’s bubble and its two lines of speech', () => {
    const paths = Array.from(renderIcon().querySelectorAll('path')).map(
      (path) => path.getAttribute('d')
    );

    expect(paths).toEqual([BUBBLE, LINES]);
  });

  it('renders at the size given, on the shared 24×24 frame', () => {
    const svg = renderIcon({ size: 22 });

    expect(svg.getAttribute('width')).toBe('22');
    expect(svg.getAttribute('height')).toBe('22');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('strokes in currentColor at the prototype’s 1.8, the bubble joined round and the lines capped round', () => {
    const [bubble, lines] = Array.from(renderIcon().querySelectorAll('path'));

    expect(bubble?.getAttribute('stroke')).toBe('currentColor');
    expect(bubble?.getAttribute('stroke-width')).toBe('1.8');
    expect(bubble?.getAttribute('stroke-linejoin')).toBe('round');
    expect(lines?.getAttribute('stroke')).toBe('currentColor');
    expect(lines?.getAttribute('stroke-width')).toBe('1.8');
    expect(lines?.getAttribute('stroke-linecap')).toBe('round');
  });

  it('is decorative unless titled', () => {
    expect(renderIcon().getAttribute('aria-hidden')).toBe('true');

    const titled = renderIcon({ title: 'Audio' });
    expect(titled.getAttribute('role')).toBe('img');
    expect(titled.querySelector('title')?.textContent).toBe('Audio');
  });
});
