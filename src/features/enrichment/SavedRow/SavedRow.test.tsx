import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { DatabaseIcon } from '@/primitives';
import { theme } from '@/styles/theme';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';
import { SavedRow, type SavedRowProps } from './SavedRow';

/**
 * 58, Folder layout (issue #545): `SavedRow` is its own unit.
 *
 * One row of _Where it is saved_: the 38px glyph tile, the title, one line
 * (sans for a plain one, mono and clipped for a path) and the badge at its
 * end. Prior art: the retired `WriteTargetRow`, less its toggle.
 */
function renderRow(props: Partial<SavedRowProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <SavedRow
        glyph={<DatabaseIcon size={19} />}
        title="Your library"
        line="Always. This is what the app reads from."
        badge="Required"
        {...props}
      />
    </ThemeProvider>
  );
}

const style = (element: Element, property: string) =>
  normCss(resolvedStyle(element)[property] ?? '');

const FOLDER_PATH = String.raw`E:\Movies`;

describe('SavedRow: the tile', () => {
  it('draws the glyph in a 38px tile on surface3', () => {
    renderRow();

    const tile = document.querySelector('svg')?.parentElement as Element;
    expect(style(tile, 'width')).toBe('38px');
    expect(style(tile, 'height')).toBe('38px');
    expect(style(tile, 'background')).toBe(normCss(theme.colors.surface3));
  });
});

describe('SavedRow: the two lines', () => {
  it('draws the title in semibold and a plain line in sans', () => {
    renderRow();

    expect(style(screen.getByText('Your library'), 'font-weight')).toBe('600');
    const line = screen.getByText('Always. This is what the app reads from.');
    expect(style(line, 'font-family')).toBe(normCss(theme.fonts.sans));
  });

  it('draws a path in mono, clipped to one line', () => {
    renderRow({
      title: 'Your library folders',
      line: FOLDER_PATH,
      path: true,
    });

    const line = screen.getByText(FOLDER_PATH);
    expect(style(line, 'font-family')).toBe(normCss(theme.fonts.mono));
    expect(style(line, 'white-space')).toBe('nowrap');
    expect(style(line, 'text-overflow')).toBe('ellipsis');
  });
});

describe('SavedRow: the badge', () => {
  it.each(['Required', 'Always'])('draws %s at the end of the row', (badge) => {
    renderRow({ badge });

    const drawn = screen.getByText(badge);
    expect(drawn.parentElement?.lastElementChild).toBe(drawn);
  });
});
