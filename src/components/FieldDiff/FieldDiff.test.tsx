import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { FieldDiff, type FieldDiffProps, type FieldDiffRow } from './FieldDiff';
import { FieldDiff as FromBarrel } from '@/components';
import { theme } from '@/styles/theme';

/**
 * 23 — Enrichment, Phase 5: "conflict Decisions" (issue #208), graduated by
 * 40 — Import review, Phase 3: "Sheet differences" (issue #333).
 *
 * `mol.FieldDiff.dc.html`: the field-by-field diff, graduated from
 * `features/enrichment/` on its second caller — the Sync's `conflict` face and
 * the import's `differs` face. A soft-bordered frame holding one row per
 * `{ key, label, mine, theirs }` — the label in a 118px cell on `bg2`, then
 * _Yours_ and the caller's `theirsLabel` (_TMDB_ or _Spreadsheet_) as two
 * buttons side by side, the chosen one on `accentSoft` with an inset
 * `accentLine` ring — and under it _Apply choices_ and _Keep all mine_.
 *
 * Generic and presentational: every row starts on the theirs side; a press on
 * a side chooses it. _Apply choices_ reports every row's side keyed by its
 * `key`, `'mine' | 'theirs'`; _Keep all mine_ reports itself and nothing else.
 * Each caller maps its own wire type on and off it.
 */

const OURS = 'A lighthouse keeper on a fading coast takes in a runaway girl…';
const THEIRS =
  'On a storm-battered coast, a solitary lighthouse keeper shelters a runaway and finds a family in the wreckage of winter.';

type Key = 'year' | 'director' | 'synopsis';

const FIELDS: FieldDiffRow<Key>[] = [
  { key: 'year', label: 'Year', mine: '2019', theirs: '2018' },
  {
    key: 'director',
    label: 'Director',
    mine: 'Eleanor Past',
    theirs: 'Eleanor Past-Whitlock',
  },
  { key: 'synopsis', label: 'Synopsis', mine: OURS, theirs: THEIRS },
];

function renderDiff(props: Partial<FieldDiffProps<Key>> = {}) {
  const handlers = {
    onApply: vi.fn<FieldDiffProps<Key>['onApply']>(),
    onKeepAll: vi.fn(),
  };
  render(
    <ThemeProvider theme={theme}>
      <FieldDiff<Key>
        rows={props.rows ?? FIELDS}
        theirsLabel={props.theirsLabel ?? 'TMDB'}
        onApply={props.onApply ?? handlers.onApply}
        onKeepAll={props.onKeepAll ?? handlers.onKeepAll}
      />
    </ThemeProvider>
  );
  return handlers;
}

/** The row a field's label heads. */
const rowOf = (label: string): HTMLElement =>
  screen.getByText(label).parentElement as HTMLElement;

const yours = (label: string) =>
  within(rowOf(label)).getByRole('button', { name: /^Yours/ });

const tmdbSide = (label: string) =>
  within(rowOf(label)).getByRole('button', { name: /^TMDB/ });

const ACCENT_SOFT = 'rgba(217, 122, 78, 0.14)';
const ACCENT_LINE = 'rgba(217, 122, 78, 0.32)';
const BORDER_SOFT = 'rgb(44, 36, 27)';
const BG_2 = 'rgb(27, 22, 17)';
const TEXT_FAINT = 'rgb(133, 122, 104)';

describe('FieldDiff — a shared molecule', () => {
  it('is re-exported by the components barrel', () => {
    expect(FromBarrel).toBe(FieldDiff);
  });
});

describe('FieldDiff — one row per differing field', () => {
  it('draws a row per field, headed by its label', () => {
    renderDiff();

    for (const { label } of FIELDS) {
      expect(screen.getByText(label)).toBeDefined();
    }
    expect(screen.getAllByRole('button', { name: /^Yours/ })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /^TMDB/ })).toHaveLength(3);
  });

  it('draws Yours with our value and TMDB with theirs', () => {
    renderDiff();

    expect(within(yours('Director')).getByText('Yours')).toBeDefined();
    expect(within(yours('Director')).getByText('Eleanor Past')).toBeDefined();
    expect(within(tmdbSide('Director')).getByText('TMDB')).toBeDefined();
    expect(
      within(tmdbSide('Director')).getByText('Eleanor Past-Whitlock')
    ).toBeDefined();
    expect(within(yours('Synopsis')).getByText(OURS)).toBeDefined();
    expect(within(tmdbSide('Synopsis')).getByText(THEIRS)).toBeDefined();
  });

  it('puts the label first, then Yours, then TMDB', () => {
    renderDiff();

    const cells = Array.from(rowOf('Year').children);
    expect(cells.map((cell) => cell.textContent)).toEqual([
      'Year',
      expect.stringMatching(/^Yours\s*2019$/),
      expect.stringMatching(/^TMDB\s*2018$/),
    ]);
  });
});

describe('FieldDiff — the theirs side chosen by default, each switchable', () => {
  it('starts every field on the theirs side', () => {
    renderDiff();

    for (const { label } of FIELDS) {
      expect(tmdbSide(label).getAttribute('aria-pressed')).toBe('true');
      expect(yours(label).getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('chooses Yours for one field on a press, leaving the others on TMDB', () => {
    renderDiff();

    fireEvent.click(yours('Director'));

    expect(yours('Director').getAttribute('aria-pressed')).toBe('true');
    expect(tmdbSide('Director').getAttribute('aria-pressed')).toBe('false');
    expect(tmdbSide('Year').getAttribute('aria-pressed')).toBe('true');
    expect(tmdbSide('Synopsis').getAttribute('aria-pressed')).toBe('true');
  });

  it('goes back to TMDB on a press of TMDB', () => {
    renderDiff();

    fireEvent.click(yours('Year'));
    fireEvent.click(tmdbSide('Year'));

    expect(tmdbSide('Year').getAttribute('aria-pressed')).toBe('true');
    expect(yours('Year').getAttribute('aria-pressed')).toBe('false');
  });
});

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

describe('FieldDiff — the prototype’s pixels', () => {
  it('frames the rows in the soft border, clipped to its radius', () => {
    renderDiff();

    const frame = getComputedStyle(rowOf('Year').parentElement as HTMLElement);
    // jsdom drops the `border` shorthand off a stylesheet rule; read its sides
    for (const side of [
      frame.borderTop,
      frame.borderRight,
      frame.borderBottom,
      frame.borderLeft,
    ]) {
      expect(side).toBe(`1px solid ${BORDER_SOFT}`);
    }
    expect(frame.borderRadius).toBe(theme.radius.md);
    expect(frame.overflow).toBe('hidden');
    expect(frame.marginTop).toBe('14px');
  });

  it('rules each row off with the soft border', () => {
    renderDiff();

    const row = getComputedStyle(rowOf('Year'));
    expect(row.display).toBe('flex');
    expect(row.borderBottom).toBe(`1px solid ${BORDER_SOFT}`);
  });

  it('draws the label in a 118px faint cell on bg2', () => {
    renderDiff();

    const label = getComputedStyle(screen.getByText('Year'));
    expect(label.flex).toBe('0 0 118px');
    expect(label.padding).toBe('13px 14px');
    expect(label.fontSize).toBe('13px');
    expect(label.fontWeight).toBe('600');
    expect(label.color).toBe(TEXT_FAINT);
    expect(label.backgroundColor).toBe(BG_2);
  });

  it('draws the chosen side on accentSoft inside an accentLine ring', () => {
    renderDiff();

    const chosen = getComputedStyle(tmdbSide('Year'));
    expect(chosen.backgroundColor).toBe(ACCENT_SOFT);
    expect(chosen.boxShadow).toBe(`inset 0 0 0 1px ${ACCENT_LINE}`);
  });

  // jsdom computes `transparent` as rgba(0, 0, 0, 0)
  it('draws the other side clear, with no ring', () => {
    renderDiff();

    const other = getComputedStyle(yours('Year'));
    expect(other.backgroundColor).toBe(TRANSPARENT);
    expect(other.boxShadow).toBe('none');
  });

  it('moves the fill with the choice', () => {
    renderDiff();

    fireEvent.click(yours('Year'));

    expect(getComputedStyle(yours('Year')).backgroundColor).toBe(ACCENT_SOFT);
    expect(getComputedStyle(tmdbSide('Year')).backgroundColor).toBe(
      TRANSPARENT
    );
  });

  it('draws both sides as equal halves after a soft rule', () => {
    renderDiff();

    for (const side of [yours('Year'), tmdbSide('Year')]) {
      const style = getComputedStyle(side);
      expect(style.flexGrow).toBe('1');
      expect(style.padding).toBe('12px 14px');
      expect(style.textAlign).toBe('left');
      expect(style.borderLeft).toBe(`1px solid ${BORDER_SOFT}`);
    }
  });

  it('prints a side’s caption small, bold and upper-cased over its value', () => {
    renderDiff();

    const caption = getComputedStyle(within(yours('Year')).getByText('Yours'));
    expect(caption.display).toBe('block');
    expect(caption.fontSize).toBe('11px');
    expect(caption.fontWeight).toBe('700');
    expect(caption.textTransform).toBe('uppercase');
    expect(caption.color).toBe(TEXT_FAINT);
    expect(caption.marginBottom).toBe('4px');

    const value = getComputedStyle(within(yours('Year')).getByText('2019'));
    expect(value.display).toBe('block');
    expect(value.fontSize).toBe('13px');
  });
});

describe('FieldDiff — Apply choices', () => {
  it('reports theirs for every field left alone, keyed by each row’s key', () => {
    const { onApply } = renderDiff();

    fireEvent.click(screen.getByRole('button', { name: 'Apply choices' }));

    expect(onApply).toHaveBeenCalledWith({
      year: 'theirs',
      director: 'theirs',
      synopsis: 'theirs',
    });
  });

  it('reports the side chosen for each field', () => {
    const { onApply } = renderDiff();

    fireEvent.click(yours('Year'));
    fireEvent.click(yours('Synopsis'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply choices' }));

    expect(onApply).toHaveBeenCalledWith({
      year: 'mine',
      director: 'theirs',
      synopsis: 'mine',
    });
  });

  it('comes before Keep all mine', () => {
    renderDiff();

    const apply = screen.getByRole('button', { name: 'Apply choices' });
    const keep = screen.getByRole('button', { name: 'Keep all mine' });
    expect(
      apply.compareDocumentPosition(keep) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

describe('FieldDiff — Keep all mine', () => {
  it('reports Keep all mine and applies nothing', () => {
    const { onApply, onKeepAll } = renderDiff();

    fireEvent.click(yours('Year'));
    fireEvent.click(screen.getByRole('button', { name: 'Keep all mine' }));

    expect(onKeepAll).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe('FieldDiff — theirsLabel', () => {
  const sheetSide = (label: string) =>
    within(rowOf(label)).getByRole('button', { name: /^Spreadsheet/ });

  it('captions the theirs side with the caller’s label', () => {
    renderDiff({ theirsLabel: 'Spreadsheet' });

    expect(
      screen.getAllByRole('button', { name: /^Spreadsheet/ })
    ).toHaveLength(3);
    expect(screen.queryAllByRole('button', { name: /^TMDB/ })).toHaveLength(0);
    expect(
      within(sheetSide('Director')).getByText('Spreadsheet')
    ).toBeDefined();
    expect(
      within(sheetSide('Director')).getByText('Eleanor Past-Whitlock')
    ).toBeDefined();
  });

  it('keeps Yours on the left and the labelled side on the right', () => {
    renderDiff({ theirsLabel: 'Spreadsheet' });

    const cells = Array.from(rowOf('Year').children);
    expect(cells.map((cell) => cell.textContent)).toEqual([
      'Year',
      expect.stringMatching(/^Yours\s*2019$/),
      expect.stringMatching(/^Spreadsheet\s*2018$/),
    ]);
  });

  it('chooses the labelled side by default, whatever it is called', () => {
    renderDiff({ theirsLabel: 'Spreadsheet' });

    for (const { label } of FIELDS) {
      expect(sheetSide(label).getAttribute('aria-pressed')).toBe('true');
      expect(yours(label).getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('reports a labelled side as theirs, never as its caption', () => {
    const { onApply } = renderDiff({ theirsLabel: 'Spreadsheet' });

    fireEvent.click(yours('Synopsis'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply choices' }));

    expect(onApply).toHaveBeenCalledWith({
      year: 'theirs',
      director: 'theirs',
      synopsis: 'mine',
    });
  });

  it('reports only the rows it was given', () => {
    const { onApply } = renderDiff({
      theirsLabel: 'Spreadsheet',
      rows: [FIELDS[1]],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Apply choices' }));

    expect(onApply).toHaveBeenCalledWith({ director: 'theirs' });
  });
});
