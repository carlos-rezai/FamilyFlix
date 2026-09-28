import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { DatabaseIcon } from '@/primitives';
import { theme } from '@/styles/theme';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';
import { WriteTargetRow, type WriteTargetRowProps } from './WriteTargetRow';

/**
 * 23 — Enrichment refactor (issue #214), Group 4: `WriteTargetRow` is its own
 * unit.
 *
 * One **Write target row**: the 38px glyph tile, the title, one line — sans
 * for a plain one, mono and clipped for a path — and either a `Toggle` named
 * by the title or the _Required_ pill.
 */
function renderRow(props: Partial<WriteTargetRowProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <WriteTargetRow
        glyph={<DatabaseIcon size={19} />}
        title="Your library"
        line="Always. This is what the app reads from."
        {...props}
      />
    </ThemeProvider>
  );
}

const style = (element: Element, property: string) =>
  normCss(resolvedStyle(element)[property] ?? '');

const SHEET = 'Metadata sheet in the collection root';
const SHEET_PATH = String.raw`E:\Movies\familyflix-metadata.csv`;

describe('WriteTargetRow — the tile', () => {
  it('draws the glyph in a 38px tile on surface3', () => {
    renderRow();

    const tile = document.querySelector('svg')?.parentElement as Element;
    expect(style(tile, 'width')).toBe('38px');
    expect(style(tile, 'height')).toBe('38px');
    expect(style(tile, 'background')).toBe(normCss(theme.colors.surface3));
  });
});

describe('WriteTargetRow — the line', () => {
  it('draws a plain line in sans', () => {
    renderRow();

    const line = screen.getByText('Always. This is what the app reads from.');
    expect(style(line, 'font-family')).toBe(normCss(theme.fonts.sans));
  });

  it('draws a path in mono, clipped to one line', () => {
    renderRow({ title: SHEET, line: SHEET_PATH, path: true });

    const line = screen.getByText(SHEET_PATH);
    expect(style(line, 'font-family')).toBe(normCss(theme.fonts.mono));
    expect(style(line, 'white-space')).toBe('nowrap');
    expect(style(line, 'text-overflow')).toBe('ellipsis');
  });
});

describe('WriteTargetRow — the trailing control', () => {
  it('draws Required, and no switch, for a target always written', () => {
    renderRow();

    expect(screen.getByText('Required')).toBeDefined();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('draws a switch named by the title for one that can be turned off', () => {
    renderRow({
      title: SHEET,
      line: SHEET_PATH,
      path: true,
      toggle: { checked: true, onToggle: () => undefined },
    });

    const toggle = screen.getByRole('switch', { name: SHEET });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByText('Required')).toBeNull();
  });

  it('reports the switch’s press', () => {
    const onToggle = vi.fn();
    renderRow({ title: SHEET, toggle: { checked: false, onToggle } });

    fireEvent.click(screen.getByRole('switch', { name: SHEET }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
