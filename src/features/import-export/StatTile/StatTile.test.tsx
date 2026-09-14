import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { StatTile, type StatTileProps } from './StatTile';
import { theme } from '@/styles/theme';

/**
 * 13 — Bulk import, Phase 4: "problems and review" (issue #129).
 *
 * One of the two tiles over the **Review step**'s list, from
 * `feat.ImportFlow.dc.html`: a 40px serif number and a two-line label under
 * it, on the surface. The first tile counts what was `matched confidently and
 * imported`, its number in the `watched` green over the soft border; the
 * second counts what `need your attention`, its number in `accent` over the
 * accent line. The tile knows nothing of the run — it draws a number, a label
 * and a tone.
 */

function renderTile(props: Partial<StatTileProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <StatTile
        value={props.value ?? 12}
        label={props.label ?? 'matched confidently and imported'}
        tone={props.tone ?? 'watched'}
        {...props}
      />
    </ThemeProvider>
  );
}

const WATCHED = 'rgb(138, 154, 107)';
const ACCENT = 'rgb(217, 122, 78)';

describe('StatTile', () => {
  it('shows the number and the label', () => {
    renderTile({ value: 12, label: 'matched confidently and imported' });

    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByText('matched confidently and imported')).toBeDefined();
  });

  it('shows a zero as a zero', () => {
    renderTile({ value: 0, label: 'need your attention' });

    expect(screen.getByText('0')).toBeDefined();
  });

  it('inks the number in the watched green for the watched tone', () => {
    renderTile({ value: 12, tone: 'watched' });

    expect(getComputedStyle(screen.getByText('12')).color).toBe(WATCHED);
  });

  it('inks the number in accent for the accent tone', () => {
    renderTile({ value: 3, tone: 'accent' });

    expect(getComputedStyle(screen.getByText('3')).color).toBe(ACCENT);
  });

  it('sets the number in the serif at 40px', () => {
    renderTile({ value: 12 });

    const number = getComputedStyle(screen.getByText('12'));
    expect(number.fontSize).toBe('40px');
    expect(number.fontFamily).toContain('Source Serif 4');
  });

  it('takes a label with a line in it, so the prototype’s two lines can be drawn', () => {
    renderTile({
      value: 3,
      label: (
        <>
          need your
          <br />
          attention
        </>
      ),
    });

    expect(screen.getByText(/need your\s*attention/)).toBeDefined();
  });
});
