import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { ActionRow, type ActionRowProps } from './ActionRow';
import { theme } from '@/styles/theme';

/**
 * 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
 *
 * One row of the Settings hub's **Library section**, from
 * `page.SettingsPage.dc.html`: a glyph in its accent tile, a label, a line
 * under it, and a chevron — the whole row one button. The row knows nothing
 * of where it leads; the section that draws it does.
 */

function renderRow(props: Partial<ActionRowProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <ActionRow
        glyph="＋"
        label="Add a movie"
        desc="Pick the video, poster, and subtitle files for one title."
        onClick={() => undefined}
        {...props}
      />
    </ThemeProvider>
  );
}

describe('ActionRow', () => {
  it('is one button, named by its label', () => {
    renderRow();

    expect(screen.getByRole('button', { name: /add a movie/i })).toBeDefined();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('draws the glyph, the label and the line under it', () => {
    renderRow();

    expect(screen.getByText('＋')).toBeDefined();
    expect(screen.getByText('Add a movie')).toBeDefined();
    expect(
      screen.getByText(
        'Pick the video, poster, and subtitle files for one title.'
      )
    ).toBeDefined();
  });

  it('reports a press', () => {
    const onClick = vi.fn();
    renderRow({ onClick });

    fireEvent.click(screen.getByRole('button', { name: /add a movie/i }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
