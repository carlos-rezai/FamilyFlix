import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { FolderShapes } from './FolderShapes';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import {
  FILM_EXAMPLE,
  RETIRED,
  RULE_NAMES,
  RULES,
  SERIES_EXAMPLE,
  holdsInOrder,
  innermostHolding,
  normalized,
} from '@/test-support/scannerBlock/scannerBlock';

function renderShapes() {
  return render(
    <ThemeProvider theme={theme}>
      <FolderShapes />
    </ThemeProvider>
  );
}

const film = () =>
  innermostHolding(FILM_EXAMPLE[0] as string, FILM_EXAMPLE.at(-1) as string);
const series = () =>
  innermostHolding(
    SERIES_EXAMPLE[0] as string,
    SERIES_EXAMPLE.at(-1) as string
  );
const rule = (index: number) => innermostHolding(RULES[index] as string);

/**
 * 76 — Whole add, Phase 7: "the scanner block" (issue #722).
 *
 * _What the scanner accepts_, from the amended `feat.ImportFlow.dc.html`
 * (log 76): under the heading, the film `Heat (1995)\` and the series
 * `The Show (2019)\` side by side in 12px mono, faint, line-height 1.8, in a
 * wrapping flex with `gap: 32px`; then three rules in 13px sans, faint, their
 * folder and file names in mono. The three shape lines and the folder-first
 * sentence are gone. It takes no props: both callers draw the same block.
 */
describe('FolderShapes — the examples', () => {
  it('draws its heading above the examples', () => {
    renderShapes();

    const heading = screen.getByText('What the scanner accepts');
    expect(comesBefore(heading, film())).toBe(true);
  });

  it('draws the film example line by line, in order', () => {
    renderShapes();

    expect(holdsInOrder(normalized(film().textContent), FILM_EXAMPLE)).toBe(
      true
    );
  });

  it('draws the series example line by line, in order', () => {
    renderShapes();

    expect(holdsInOrder(normalized(series().textContent), SERIES_EXAMPLE)).toBe(
      true
    );
  });

  it('sets each example on its own, the film before the series', () => {
    renderShapes();

    expect(film()).not.toBe(series());
    expect(film().contains(series())).toBe(false);
    expect(series().contains(film())).toBe(false);
    expect(comesBefore(film(), series())).toBe(true);
  });

  it('sets both examples in 12px mono, faint, at line-height 1.8', () => {
    renderShapes();

    for (const example of [film(), series()]) {
      const drawn = getComputedStyle(example);
      expect(drawn.fontFamily).toContain('JetBrains Mono');
      expect(drawn.fontSize).toBe('12px');
      expect(drawn.lineHeight).toBe('1.8');
      expect(drawn.color).toBe(getComputedStyle(rule(0)).color);
    }
  });

  it('sits the examples side by side in a wrapping flex, 32px apart', () => {
    renderShapes();

    const row = innermostHolding(
      FILM_EXAMPLE[0] as string,
      SERIES_EXAMPLE[0] as string
    );
    expect(row.contains(film())).toBe(true);
    expect(row.contains(series())).toBe(true);
    const drawn = getComputedStyle(row);
    expect(drawn.display).toBe('flex');
    expect(drawn.gap).toBe('32px');
    expect(drawn.flexWrap).toBe('wrap');
  });
});

describe('FolderShapes — the rules', () => {
  it('states the three rules word for word, in order, after the examples', () => {
    renderShapes();

    const text = normalized(document.body.textContent);
    expect(holdsInOrder(text, RULES)).toBe(true);
    expect(comesBefore(series(), rule(0))).toBe(true);
  });

  it('draws each rule as its own line in 13px sans, faint', () => {
    renderShapes();

    const rules = RULES.map((_, index) => rule(index));
    expect(new Set(rules).size).toBe(3);
    for (const drawnRule of rules) {
      const drawn = getComputedStyle(drawnRule);
      expect(drawn.display).toBe('block');
      expect(drawn.fontFamily).toContain('Hanken Grotesk');
      expect(drawn.fontSize).toBe('13px');
      expect(drawn.color).toBe(getComputedStyle(rules[0] as HTMLElement).color);
    }
  });

  it('sets the rules’ folder and file names in mono', () => {
    renderShapes();

    for (const name of RULE_NAMES) {
      expect(getComputedStyle(screen.getByText(name)).fontFamily).toContain(
        'JetBrains Mono'
      );
    }
  });

  it('no longer draws the retired shape lines or the folder-first sentence', () => {
    renderShapes();

    const text = normalized(document.body.textContent);
    for (const retired of RETIRED) {
      expect(text).not.toContain(retired);
    }
  });
});

/**
 * 74 — Sheet in sight, Phase 4 (issue #704), its place moved by log 76.
 *
 * The **Sheet note**, from the amended `feat.ImportFlow.dc.html`: a paragraph
 * after the rules, in their style, the path `_meta\familyflix-library.csv` in
 * mono. No control comes with it.
 */
const SHEET_PATH = '_meta\\familyflix-library.csv';
const SHEET_NOTE = `FamilyFlix keeps a sheet of each folder’s titles in ${SHEET_PATH} and reads it first, so a scan after a reset or on another computer brings every title back as it was, ratings, hearts and what’s been watched included.`;
const LAST_RULE = RULES[2] as string;

describe('FolderShapes — the Sheet note', () => {
  it('states the Sheet note word for word, after the rules', () => {
    renderShapes();

    const text = normalized(document.body.textContent);
    expect(text).toContain(SHEET_NOTE);
    expect(text).toContain(LAST_RULE);
    expect(text.indexOf(LAST_RULE)).toBeLessThan(text.indexOf(SHEET_NOTE));
  });

  it('sets the sheet’s path in mono', () => {
    renderShapes();

    expect(getComputedStyle(screen.getByText(SHEET_PATH)).fontFamily).toContain(
      'JetBrains Mono'
    );
  });

  it('draws the note as its own paragraph, in the rules’ style', () => {
    renderShapes();

    const note = innermostHolding(SHEET_NOTE);
    const ruled = rule(2);
    expect(note).not.toBe(ruled);
    expect(ruled.contains(note)).toBe(false);
    expect(note.contains(ruled)).toBe(false);
    const drawn = getComputedStyle(note);
    const ruledStyle = getComputedStyle(ruled);
    expect(drawn.fontFamily).toContain('Hanken Grotesk');
    expect(drawn.fontSize).toBe(ruledStyle.fontSize);
    expect(drawn.color).toBe(ruledStyle.color);
    expect(drawn.display).toBe('block');
  });

  it('draws the note and no control with it', () => {
    renderShapes();

    expect(normalized(document.body.textContent)).toContain(SHEET_NOTE);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });
});
