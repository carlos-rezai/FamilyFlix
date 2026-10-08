import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { FolderShapes } from './FolderShapes';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';

/**
 * 30 — Library folders, Phase 2: "the Folder scan" (issue #269).
 *
 * _What the scanner accepts_, extracted from `ImportSetup` on its second
 * caller — the Library folders page's group **Scan** — and word for word from
 * `feat.ImportFlow.dc.html`: the heading, the three shapes in mono with the
 * prototype's backslashes — the loose shape's note in the sans face — and the
 * folder-first rule, its two tags in mono. It takes no props: both callers
 * draw the same block.
 */

function renderShapes() {
  return render(
    <ThemeProvider theme={theme}>
      <FolderShapes />
    </ThemeProvider>
  );
}

const normalized = (text: string | null) =>
  (text ?? '').replace(/\s+/g, ' ').trim();

/** The deepest element whose text holds `text` — whatever it is nested in. */
function innermost(text: string): HTMLElement {
  const holding = Array.from(document.body.querySelectorAll('*')).filter(
    (element) => normalized(element.textContent).includes(text)
  );
  const deepest = holding.filter(
    (element) =>
      !holding.some((other) => other !== element && element.contains(other))
  );
  if (deepest.length !== 1) {
    throw new Error(
      `expected one element holding "${text}", found ${deepest.length}`
    );
  }
  return deepest[0] as HTMLElement;
}

const SHAPES = [
  'Movie Title (2019)\\ movie.mkv · subs.en.srt',
  'Show Name\\ Season 01\\ S01E03.mkv',
  'Show Name\\ S01E03.mkv',
];
const LOOSE_NOTE = '— loose episodes at the show root are fine';
const RULE =
  'Season and episode numbers come from the folder first, then the filename (S01E03, 1x03). Anything it can’t place lands in the review list.';

describe('FolderShapes — what the scanner accepts', () => {
  it('draws its heading above the shapes', () => {
    renderShapes();

    const heading = screen.getByText('What the scanner accepts');
    expect(comesBefore(heading, innermost(SHAPES[0] as string))).toBe(true);
  });

  it('lists the three shapes, in order, with the prototype’s backslashes', () => {
    renderShapes();

    const text = normalized(document.body.textContent);
    const at = SHAPES.map((shape) => text.indexOf(shape));
    expect(at.every((index) => index >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(text).toContain(`${SHAPES[2]} ${LOOSE_NOTE}`);
  });

  it('sets the shapes in mono and the loose shape’s note in the sans face', () => {
    renderShapes();

    for (const shape of SHAPES) {
      expect(getComputedStyle(innermost(shape)).fontFamily).toContain(
        'JetBrains Mono'
      );
    }
    expect(getComputedStyle(innermost(LOOSE_NOTE)).fontFamily).toContain(
      'Hanken Grotesk'
    );
  });

  it('states the folder-first rule word for word, after the shapes', () => {
    renderShapes();

    const text = normalized(document.body.textContent);
    expect(text).toContain(RULE);
    expect(text.indexOf(SHAPES[2] as string)).toBeLessThan(text.indexOf(RULE));
  });

  it('sets the rule’s two tags in mono', () => {
    renderShapes();

    for (const tag of ['S01E03', '1x03']) {
      expect(getComputedStyle(screen.getByText(tag)).fontFamily).toContain(
        'JetBrains Mono'
      );
    }
  });
});
